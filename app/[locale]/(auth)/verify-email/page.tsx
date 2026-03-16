import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function VerifyEmailPage() {
  const t = await getTranslations("auth.verifyEmail");

  return (
    <div style={{ textAlign: "center" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {t("subtitle")}
      </p>
      <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 16 }}>
        {t("noEmail")}
        <Link href="/register" style={{ color: "var(--brand)", marginLeft: 4, textDecoration: "none" }}>
          {t("backToRegister")}
        </Link>
      </p>
      <Link
        href="/login"
        className="btn-primary"
        style={{
          display: "inline-block",
          marginTop: 28,
          padding: "12px 24px",
          textDecoration: "none",
        }}
      >
        {t("backToLogin")}
      </Link>
    </div>
  );
}
