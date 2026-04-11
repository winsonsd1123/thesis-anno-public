"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { adminCreateUser } from "@/lib/actions/user.admin.actions";

export function AdminUserCreateForm() {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await adminCreateUser(email, password);
      if (result.success) {
        router.push(`/admin/users/${result.userId}`);
        router.refresh();
      } else {
        const msg =
          result.error === "INVALID_INPUT" ? t("errorInvalidInput") : t("errorGeneric", { message: result.error });
        alert(msg);
      }
    });
  };

  return (
    <div
      style={{
        marginBottom: 28,
        padding: 16,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t("createTitle")}</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <label htmlFor="createEmail" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {t("createEmail")}
          </label>
          <input
            id="createEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 14,
              minWidth: 220,
            }}
          />
        </div>
        <div>
          <label htmlFor="createPw" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {t("createPassword")}
          </label>
          <input
            id="createPw"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 14,
              minWidth: 180,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            background: "var(--brand)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {t("createSubmit")}
        </button>
      </form>
    </div>
  );
}
