/**
 * Canonical site origin for sitemap, robots, metadataBase, JSON-LD.
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://thesis.ollagle.com).
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  return "http://localhost:3000";
}
