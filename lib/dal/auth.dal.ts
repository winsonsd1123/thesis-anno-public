import { createClient } from "@/lib/supabase/server";
import type { SignUpInput, SignInInput } from "@/lib/schemas/auth.schema";

export type SignInWithEmailOtpParams = {
  email: string;
  /** 魔法链接兜底；OTP 邮件通常不依赖此项，但部分项目模板会带链接 */
  emailRedirectTo?: string;
  shouldCreateUser?: boolean;
};

export type VerifyEmailOtpParams = {
  email: string;
  token: string;
};

export const authDAL = {
  async signUp(input: SignUpInput & { redirectTo?: string }) {
    const supabase = await createClient();
    return supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: input.redirectTo,
        data: input.fullName ? { full_name: input.fullName } : undefined,
      },
    });
  },

  async signInWithPassword(input: SignInInput) {
    const supabase = await createClient();
    return supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
  },

  async signInWithOAuth(provider: "google" | "github", redirectTo: string) {
    const supabase = await createClient();
    return supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  },

  async signInWithEmailOtp(params: SignInWithEmailOtpParams) {
    const supabase = await createClient();
    return supabase.auth.signInWithOtp({
      email: params.email,
      options: {
        shouldCreateUser: params.shouldCreateUser ?? false,
        emailRedirectTo: params.emailRedirectTo,
      },
    });
  },

  async verifyEmailOtp(params: VerifyEmailOtpParams) {
    const supabase = await createClient();
    return supabase.auth.verifyOtp({
      email: params.email,
      token: params.token,
      type: "email",
    });
  },

  async signOut() {
    const supabase = await createClient();
    return supabase.auth.signOut();
  },

  async resetPasswordForEmail(email: string, redirectTo: string) {
    const supabase = await createClient();
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
  },

  async updateUserPassword(password: string) {
    const supabase = await createClient();
    return supabase.auth.updateUser({ password });
  },

  async getUser() {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
};
