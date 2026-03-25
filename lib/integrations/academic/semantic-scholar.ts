import { fetchJson, semanticScholarHeaders } from "./http";
import type { ReferenceCandidate } from "./types";
import { normTitle } from "./title-normalize";

type S2SearchResp = {
  data?: Array<{
    title?: string;
    year?: number;
    venue?: string;
    authors?: Array<{ name?: string }>;
    externalIds?: { DOI?: string };
  }>;
};

export async function searchSemanticScholar(title: string): Promise<ReferenceCandidate | null> {
  const q = normTitle(title);
  if (q.length < 6) return null;
  const data = await fetchJson<S2SearchResp>(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=1&fields=title,year,venue,authors,externalIds`,
    { headers: semanticScholarHeaders() }
  );
  const p = data?.data?.[0];
  if (!p?.title) return null;
  const authors = p.authors?.map((a) => a.name).filter(Boolean) as string[] | undefined;
  return {
    source: "semantic_scholar",
    title: p.title,
    authors: authors?.length ? authors : null,
    year: p.year ?? null,
    doi: p.externalIds?.DOI ?? null,
    venue: p.venue ?? null,
  };
}
