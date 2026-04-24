import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPackages } from "@/lib/config/billing";
import { buildPublicPageMetadata } from "@/lib/seo-metadata";
import { HomeContent } from "./HomeContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return {
    title: t("homeTitle"),
    description: t("homeDescription"),
    ...buildPublicPageMetadata({ locale, pathAfterLocale: "" }),
  };
}

export default async function HomePage() {
  const packages = await getPackages();
  return <HomeContent packages={packages} />;
}
