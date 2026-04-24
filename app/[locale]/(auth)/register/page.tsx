import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buildPublicPageMetadata } from "@/lib/seo-metadata";
import { RegisterPageClient } from "./RegisterPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.register" });
  return {
    title: t("title"),
    ...buildPublicPageMetadata({ locale, pathAfterLocale: "register" }),
  };
}

export default function RegisterPage() {
  return <RegisterPageClient />;
}
