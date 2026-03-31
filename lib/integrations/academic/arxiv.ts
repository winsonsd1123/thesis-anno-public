import { ACADEMIC_FETCH_TIMEOUT_MS, politeUserAgent } from "./http";
import type { ReferenceCandidate } from "./types";
import { normTitle, titlesExactMatchNormalized } from "./title-normalize";

export async function searchArxiv(title: string): Promise<ReferenceCandidate | null> {
  const q = normTitle(title);
  if (q.length < 6) return null;
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(`ti:${q}`)}&max_results=5`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ACADEMIC_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": politeUserAgent() } });
    if (!res.ok) return null;
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => m[1]);
    for (const entry of entries) {
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      const entryTitle = titleMatch?.[1]?.replace(/\s+/g, " ").trim();
      if (!entryTitle || !titlesExactMatchNormalized(title, entryTitle)) continue;
      const idMatch = entry.match(/<id>http:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
      const arxivId = idMatch?.[1] ?? null;
      const published = entry.match(/<published>(\d{4})/);
      const year = published?.[1] ? parseInt(published[1], 10) : null;
      return {
        source: "arxiv",
        title: entryTitle,
        authors: null,
        year,
        doi: arxivId ? `10.48550/arXiv.${arxivId}` : null,
        venue: "arXiv",
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
