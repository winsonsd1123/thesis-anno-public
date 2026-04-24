import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-metadata";
import { LoginPageClient } from "./LoginPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.login" });
  return {
    title: t("title"),
    ...buildPublicPageMetadata({ locale, pathAfterLocale: "login" }),
  };
}

export default function LoginPage() {
  return <LoginPageClient />;
}
