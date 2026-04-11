import { authDAL } from "@/lib/dal/auth.dal";
import type {
  SignUpInput,
  SignInInput,
  EmailOtpSendInput,
  EmailOtpVerifyInput,
} from "@/lib/schemas/auth.schema";

export const authService = {
  async signUp(input: SignUpInput, origin: string) {
    const redirectTo = `${origin}/auth/callback`;
    return authDAL.signUp({ ...input, redirectTo });
  },

  async signIn(input: SignInInput) {
    return authDAL.signInWithPassword(input);
  },

  async signInWithOAuth(provider: "google" | "github", origin: string) {
    const redirectTo = `${origin}/auth/callback`;
    return authDAL.signInWithOAuth(provider, redirectTo);
  },

  /**
   * 向已注册邮箱发送登录 OTP（不自动创建用户）。
   * emailRedirectTo 供邮件内魔法链接使用，与 OTP 输入框登录并存。
   */
  async sendEmailLoginOtp(input: EmailOtpSendInput, origin: string) {
    const emailRedirectTo = `${origin}/auth/callback`;
    return authDAL.signInWithEmailOtp({
      email: input.email,
      emailRedirectTo,
      shouldCreateUser: false,
    });
  },

  async verifyEmailLoginOtp(input: EmailOtpVerifyInput) {
    return authDAL.verifyEmailOtp({
      email: input.email,
      token: input.token,
    });
  },

  async signOut() {
    return authDAL.signOut();
  },

  async resetPasswordForEmail(email: string, origin: string) {
    const redirectTo = `${origin}/auth/callback?next=/update-password`;
    return authDAL.resetPasswordForEmail(email, redirectTo);
  },

  async updatePassword(password: string) {
    return authDAL.updateUserPassword(password);
  },

  /**
   * 设置页改密：先用语验证当前密码，再更新为新密码（同一 Cookie 会话）。
   */
  async changePasswordWithCurrentPassword(
    email: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ ok: true } | { ok: false; code: "wrong_current" | "update_failed"; detail?: string }> {
    const { error: signInError } = await authDAL.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      return {
        ok: false,
        code: "wrong_current",
        detail: signInError.message,
      };
    }
    const { error } = await authDAL.updateUserPassword(newPassword);
    if (error) {
      return {
        ok: false,
        code: "update_failed",
        detail: error.message,
      };
    }
    return { ok: true };
  },
};
