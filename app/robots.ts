import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

function privateDisallows(): string[] {
  const paths = ["dashboard", "admin", "account-disabled", "update-password"];
  return routing.locales.flatMap((locale) => paths.map((p) => `/${locale}/${p}`));
}

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  const disallow = privateDisallows();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow,
      },
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
