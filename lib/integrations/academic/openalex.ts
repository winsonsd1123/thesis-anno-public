import { fetchJson } from "./http";
import type { ReferenceCandidate } from "./types";
import { normTitle, titlesExactMatchNormalized } from "./title-normalize";

type OpenAlexResp = {
  results?: Array<{
    display_name?: string;
    publication_year?: number;
    doi?: string;
    authorships?: Array<{ author?: { display_name?: string } }>;
    host_venue?: { display_name?: string };
    primary_location?: { source?: { display_name?: string } };
  }>;
};

export async function searchOpenAlex(title: string): Promise<ReferenceCandidate | null> {
  const q = normTitle(title);
  if (q.length < 6) return null;
  const data = await fetchJson<OpenAlexResp>(
    `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=5`
  );
  const results = data?.results;
  if (!results?.length) return null;
  for (const w of results) {
    if (!w?.display_name) continue;
    if (!titlesExactMatchNormalized(title, w.display_name)) continue;
    const authors = w.authorships?.map((a) => a.author?.display_name).filter(Boolean) as
      | string[]
      | undefined;
    return {
      source: "openalex",
      title: w.display_name,
      authors: authors?.length ? authors : null,
      year: w.publication_year ?? null,
      doi: w.doi?.replace("https://doi.org/", "") ?? null,
      venue: w.host_venue?.display_name ?? w.primary_location?.source?.display_name ?? null,
    };
  }
  return null;
}
