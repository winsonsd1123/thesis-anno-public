import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MarketingPageShell } from "@/app/components/marketing/MarketingPageShell";
import { C } from "@/app/components/landing/constants";
import { buildPublicPageMetadata } from "@/lib/seo-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    ...buildPublicPageMetadata({ locale, pathAfterLocale: "about" }),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("marketing.about");
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <MarketingPageShell backLabel={t("backHome")}>
      <h1 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 800, marginBottom: 16, letterSpacing: "-0.5px" }}>
        {t("title")}
      </h1>
      <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: 20 }}>{t("intro")}</p>
      <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: 36 }}>{t("body")}</p>

      <section id="contact">
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: C.textPrimary }}>{t("contactHeading")}</h2>
        {email ? (
          <p style={{ color: C.textSecondary, lineHeight: 1.75 }}>
            {t("contactEmailLead")}{" "}
            <a href={`mailto:${email}`} style={{ color: C.brand, textDecoration: "none" }}>
              {email}
            </a>
          </p>
        ) : (
          <p style={{ color: C.textSecondary, lineHeight: 1.75 }}>{t("contactNoEmail")}</p>
        )}
        <p style={{ color: C.textMuted, lineHeight: 1.75, marginTop: 16, fontSize: 14 }}>{t("contactWechatNote")}</p>
      </section>
    </MarketingPageShell>
  );
}
