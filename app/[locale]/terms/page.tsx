import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  MarketingPageShell,
  MarketingSections,
  type MarketingSection,
} from "@/app/components/marketing/MarketingPageShell";
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
    title: t("termsTitle"),
    description: t("termsDescription"),
    ...buildPublicPageMetadata({ locale, pathAfterLocale: "terms" }),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("marketing.terms");
  const sections = t.raw("sections") as MarketingSection[];
  return (
    <MarketingPageShell backLabel={t("backHome")}>
      <h1 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 800, marginBottom: 16, letterSpacing: "-0.5px" }}>
        {t("title")}
      </h1>
      <p style={{ color: C.textSecondary, lineHeight: 1.7, marginBottom: 32 }}>{t("intro")}</p>
      <MarketingSections sections={sections} />
    </MarketingPageShell>
  );
}
