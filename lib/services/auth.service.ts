import { authDAL } from "@/lib/dal/auth.dal";
import type { SignUpInput, SignInInput } from "@/lib/schemas/auth.schema";

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
};
