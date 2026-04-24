import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-metadata";
import { ForgotPasswordPageClient } from "./ForgotPasswordPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.forgotPassword" });
  return {
    title: t("title"),
    ...buildPublicPageMetadata({ locale, pathAfterLocale: "forgot-password" }),
  };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordPageClient />;
}
