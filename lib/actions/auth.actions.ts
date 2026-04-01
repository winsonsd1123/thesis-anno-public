"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { authService } from "@/lib/services/auth.service";
import {
  signUpSchema,
  signInSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  changePasswordInSettingsSchema,
} from "@/lib/schemas/auth.schema";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type AuthActionResult = { success: boolean; error?: string };

export async function signUp(
  _prev: unknown,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  try {
    const headersList = await headers();
    const origin = headersList.get("x-forwarded-host")
      ? `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("x-forwarded-host")}`
      : headersList.get("origin") ?? "http://localhost:3000";

    const { data, error } = await authService.signUp(parsed.data, origin);

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.user && !data?.session) {
      redirect("/verify-email");
    }

    redirect("/dashboard");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return {
      success: false,
      error: process.env.NODE_ENV === "production" ? "注册失败" : String(e),
    };
  }
}

export async function signIn(
  _prev: unknown,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  try {
    const { error } = await authService.signIn(parsed.data);

    if (error) {
      return { success: false, error: error.message };
    }

    redirect("/dashboard");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return {
      success: false,
      error: process.env.NODE_ENV === "production" ? "登录失败" : String(e),
    };
  }
}

export async function signInWithOAuth(
  provider: "google" | "github"
): Promise<{ redirectUrl?: string; error?: string }> {
  try {
    const headersList = await headers();
    const origin = headersList.get("x-forwarded-host")
      ? `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("x-forwarded-host")}`
      : headersList.get("origin") ?? "http://localhost:3000";

    const { data, error } = await authService.signInWithOAuth(provider, origin);

    if (error) {
      return { error: error.message };
    }

    return { redirectUrl: data?.url };
  } catch (e) {
    return {
      error: process.env.NODE_ENV === "production" ? "OAuth 登录失败" : String(e),
    };
  }
}

export async function signOut(): Promise<AuthActionResult> {
  try {
    await authService.signOut();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: process.env.NODE_ENV === "production" ? "退出失败" : String(e),
    };
  }
}

export async function resetPassword(
  _prev: unknown,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  try {
    const headersList = await headers();
    const origin = headersList.get("x-forwarded-host")
      ? `${headersList.get("x-forwarded-proto") ?? "https"}://${headersList.get("x-forwarded-host")}`
      : headersList.get("origin") ?? "http://localhost:3000";

    const { error } = await authService.resetPasswordForEmail(
      parsed.data.email,
      origin
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "发送重置邮件失败"
          : String(e),
    };
  }
}

export async function changePasswordInSettings(
  _prev: unknown,
  formData: FormData
): Promise<AuthActionResult> {
  const t = await getTranslations("dashboard.changePasswordForm");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user?.email) {
    return { success: false, error: t("errorNotLoggedIn") };
  }

  const hasEmailIdentity = user.identities?.some((i) => i.provider === "email");
  if (!hasEmailIdentity) {
    return { success: false, error: t("errorNotSupported") };
  }

  const parsed = changePasswordInSettingsSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? t("errorValidation"),
    };
  }

  const { currentPassword, newPassword, confirmNewPassword } = parsed.data;
  if (currentPassword === newPassword) {
    return { success: false, error: t("errorSameAsCurrent") };
  }
  if (newPassword !== confirmNewPassword) {
    return { success: false, error: t("errorPasswordMismatch") };
  }

  try {
    const result = await authService.changePasswordWithCurrentPassword(
      user.email,
      currentPassword,
      newPassword
    );

    if (!result.ok) {
      if (result.code === "wrong_current") {
        return {
          success: false,
          error:
            process.env.NODE_ENV === "development" && result.detail
              ? `${t("errorWrongCurrent")} (${result.detail})`
              : t("errorWrongCurrent"),
        };
      }
      return {
        success: false,
        error:
          process.env.NODE_ENV === "development" && result.detail
            ? `${t("errorUpdateFailed")} (${result.detail})`
            : t("errorUpdateFailed"),
      };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? t("errorUpdateFailed")
          : String(e),
    };
  }
}

export async function updatePassword(
  _prev: unknown,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  try {
    const { error } = await authService.updatePassword(parsed.data.password);

    if (error) {
      return { success: false, error: error.message };
    }

    redirect("/dashboard");
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return {
      success: false,
      error:
        process.env.NODE_ENV === "production" ? "密码更新失败" : String(e),
    };
  }
}
