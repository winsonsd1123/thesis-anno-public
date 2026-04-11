import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function AccountDisabledPage() {
  const t = await getTranslations("accountDisabled");

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        maxWidth: 480,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
        {t("title")}
      </h1>
      <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
        {t("body")}
      </p>
      <Link
        href="/"
        style={{
          fontSize: 15,
          color: "var(--brand)",
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
