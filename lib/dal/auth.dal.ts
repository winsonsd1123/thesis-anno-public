import { createClient } from "@/lib/supabase/server";
import type { SignUpInput, SignInInput } from "@/lib/schemas/auth.schema";

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
