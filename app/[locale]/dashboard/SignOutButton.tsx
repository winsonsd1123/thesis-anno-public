"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/actions/auth.actions";

export function SignOutButton() {
  const router = useRouter();
  const t = useTranslations("dashboard");

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      style={{
        fontSize: 14,
        color: "var(--text-secondary)",
        background: "none",
        border: "none",
        cursor: "pointer",
      }}
    >
      {t("signOut")}
    </button>
  );
}
