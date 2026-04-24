import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

type Locale = (typeof routing.locales)[number];

/**
 * Canonical + hreflang for a public route under `[locale]`.
 * `pathAfterLocale` is the path after `/${locale}/`, no leading slash (e.g. `login`, or empty string for home).
 */
export function buildPublicPageMetadata(opts: {
  locale: string;
  pathAfterLocale: string;
}): Metadata {
  const base = getSiteUrl();
  const { locale, pathAfterLocale } = opts;
  const suffix = pathAfterLocale ? `/${pathAfterLocale}` : "";
  const canonicalPath = `/${locale}${suffix}`;
  const canonical = new URL(canonicalPath, base).toString();

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = `${base}/${l}${suffix}`;
  }

  return {
    alternates: {
      canonical,
      languages,
    },
  };
}

export function isAppLocale(locale: string): locale is Locale {
  return routing.locales.includes(locale as Locale);
}
