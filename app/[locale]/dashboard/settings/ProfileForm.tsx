"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { updateProfile } from "@/lib/actions/profile.actions";
import { AvatarUpload } from "@/app/components/profile/AvatarUpload";
import type { UserProfileDTO } from "@/lib/dtos/user.dto";

export function ProfileForm({ profile }: { profile: UserProfileDTO | null }) {
  const t = useTranslations("dashboard.profileForm");
  const [state, formAction, isPending] = useActionState(updateProfile, null);

  return (
    <form action={formAction} className="profile-form-card">
      {/* 消息提示 */}
      {state?.error && (
        <div
          className="form-message form-message-error"
          style={{
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.08)",
            borderRadius: 10,
            color: "var(--danger)",
            fontSize: 14,
            border: "1px solid rgba(239, 68, 68, 0.2)",
            marginBottom: 24,
          }}
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          className="form-message form-message-success"
          style={{
            padding: "12px 16px",
            background: "rgba(16, 185, 129, 0.08)",
            borderRadius: 10,
            color: "var(--success)",
            fontSize: 14,
            border: "1px solid rgba(16, 185, 129, 0.2)",
            marginBottom: 24,
          }}
        >
          {t("saveSuccess")}
        </div>
      )}

      {/* 头像区块 */}
      <section className="profile-form-section">
        <label
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 14,
            color: "var(--text-primary)",
            fontFamily: "Sora, sans-serif",
          }}
        >
          {t("avatar")}
        </label>
        <AvatarUpload
          currentUrl={profile?.avatarUrl ?? null}
          onUrlChange={(url) => {
            const input = document.getElementById("avatarUrl") as HTMLInputElement;
            if (input) input.value = url;
          }}
        />
        <input
          id="avatarUrl"
          name="avatarUrl"
          type="hidden"
          defaultValue={profile?.avatarUrl ?? ""}
        />
      </section>

      {/* 分隔线 */}
      <hr
        style={{
          border: "none",
          height: 1,
          background: "var(--border)",
          margin: "28px 0",
        }}
      />

      {/* 昵称区块 */}
      <section className="profile-form-section">
        <label
          htmlFor="fullName"
          style={{
            display: "block",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 10,
            color: "var(--text-primary)",
            fontFamily: "Sora, sans-serif",
          }}
        >
          {t("nickname")}
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={profile?.fullName ?? ""}
          placeholder={t("nicknamePlaceholder")}
          className="profile-form-input"
        />
      </section>

      {/* 提交按钮 */}
      <div style={{ marginTop: 32 }}>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary"
          style={{
            padding: "12px 28px",
            fontSize: 15,
            minWidth: 120,
          }}
        >
          {isPending ? t("saving") : t("save")}
        </button>
      </div>
    </form>
  );
}
