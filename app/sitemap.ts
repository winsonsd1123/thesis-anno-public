import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

/** Public paths after `/${locale}/` (empty = home). */
const PUBLIC_PATH_SUFFIXES = [
  "",
  "login",
  "register",
  "forgot-password",
  "verify-email",
  "docs",
  "grading-standards",
  "sample-report",
  "about",
  "privacy",
  "terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const suffix of PUBLIC_PATH_SUFFIXES) {
      const path = suffix ? `/${locale}/${suffix}` : `/${locale}`;
      const url = new URL(path, base).toString();
      const priority =
        suffix === ""
          ? 1
          : suffix === "login" || suffix === "register"
            ? 0.8
            : suffix === "forgot-password" || suffix === "verify-email"
              ? 0.5
              : 0.6;
      entries.push({
        url,
        lastModified: new Date(),
        changeFrequency: suffix === "" ? "weekly" : "monthly",
        priority,
      });
    }
  }

  return entries;
}
