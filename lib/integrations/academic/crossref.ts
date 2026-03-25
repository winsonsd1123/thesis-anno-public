import { fetchJson } from "./http";
import type { ReferenceCandidate } from "./types";
import { normTitle } from "./title-normalize";

type CrossrefWorkMessage = {
  DOI?: string;
  title?: string[];
  author?: Array<{ family?: string; given?: string; name?: string }>;
  issued?: { "date-parts"?: number[][] };
  "published-print"?: { "date-parts"?: number[][] };
  "container-title"?: string[];
};

function crossrefMessageToCandidate(msg: CrossrefWorkMessage): ReferenceCandidate {
  const title = msg.title?.[0] ?? null;
  const authors =
    msg.author?.map((a) => {
      if (a.name) return a.name;
      const f = a.family ?? "";
      const g = a.given ?? "";
      return `${g} ${f}`.trim();
    }) ?? null;
  const year =
    msg.issued?.["date-parts"]?.[0]?.[0] ??
    msg["published-print"]?.["date-parts"]?.[0]?.[0] ??
    null;
  return {
    source: "crossref",
    title,
    authors,
    year,
    doi: null,
    venue: msg["container-title"]?.[0] ?? null,
  };
}

export async function searchCrossRefByDoi(doi: string): Promise<ReferenceCandidate | null> {
  const clean = doi.trim();
  if (!clean) return null;
  const enc = encodeURIComponent(clean);
  const data = await fetchJson<{ message?: CrossrefWorkMessage }>(
    `https://api.crossref.org/works/${enc}`
  );
  const msg = data?.message;
  if (!msg?.title?.length) return null;
  const c = crossrefMessageToCandidate(msg);
  const doiFromMsg = msg.DOI ?? clean;
  return { ...c, doi: doiFromMsg };
}

export async function searchCrossRefByTitle(title: string): Promise<ReferenceCandidate | null> {
  const q = normTitle(title);
  if (q.length < 6) return null;
  const data = await fetchJson<{
    message?: { items?: CrossrefWorkMessage[] };
  }>(
    `https://api.crossref.org/works?query.title=${encodeURIComponent(q)}&rows=1`
  );
  const item = data?.message?.items?.[0];
  if (!item?.title?.length) return null;
  const c = crossrefMessageToCandidate(item);
  const doi = item.DOI ?? null;
  return { ...c, doi };
}
