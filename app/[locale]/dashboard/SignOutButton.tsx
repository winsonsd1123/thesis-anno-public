"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { signOut } from "@/lib/actions/auth.actions";
import styles from "./SignOutButton.module.css";

type Props = {
  className?: string;
};

export function SignOutButton({ className }: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      const res = await signOut();
      if (!res.success) {
        setError(res.error ?? t("signOutFailed"));
        setPending(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t("signOutFailed"));
      setPending(false);
    }
  }

  const defaultStyle =
    className === undefined
      ? {
          fontSize: 14,
          color: "var(--text-secondary)",
          background: "none",
          border: "none",
          cursor: pending ? ("wait" as const) : ("pointer" as const),
        }
      : undefined;

  return (
    <span className={styles.wrap}>
      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={pending}
        className={className}
        style={defaultStyle}
        aria-busy={pending}
      >
        <span className={styles.inner}>
          {pending ? (
            <>
              <span className={styles.spinner} aria-hidden />
              <span>{t("signOutPending")}</span>
            </>
          ) : (
            t("signOut")
          )}
        </span>
      </button>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
