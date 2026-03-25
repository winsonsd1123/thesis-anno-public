import { fetchJson } from "./http";
import type { ReferenceCandidate } from "./types";
import { normTitle } from "./title-normalize";

type ESearchResp = {
  esearchresult?: { idlist?: string[] };
};

type ESummaryResp = {
  result?: Record<
    string,
    {
      title?: string;
      authors?: Array<{ name?: string }>;
      pubdate?: string;
      fulljournalname?: string;
    }
  >;
};

export async function searchPubMed(
  query: string,
  opts?: { byId?: boolean }
): Promise<ReferenceCandidate | null> {
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const mail = process.env.ACADEMIC_API_CONTACT_EMAIL?.trim() || "support@example.com";
  const tool = "thesisanno";

  if (opts?.byId) {
    const id = query.trim();
    if (!/^\d+$/.test(id)) return null;
    const sum = await fetchJson<ESummaryResp>(
      `${base}/esummary.fcgi?db=pubmed&id=${encodeURIComponent(id)}&retmode=json&tool=${tool}&email=${encodeURIComponent(mail)}`
    );
    const rec = sum?.result?.[id];
    if (!rec?.title) return null;
    const authors = rec.authors?.map((a) => a.name).filter(Boolean) as string[] | undefined;
    let year: number | null = null;
    const m = rec.pubdate?.match(/(\d{4})/);
    if (m) year = parseInt(m[1], 10);
    return {
      source: "pubmed",
      title: rec.title,
      authors: authors?.length ? authors : null,
      year,
      doi: null,
      venue: rec.fulljournalname ?? null,
    };
  }

  const q = normTitle(query);
  if (q.length < 6) return null;
  const search = await fetchJson<ESearchResp>(
    `${base}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=1&retmode=json&tool=${tool}&email=${encodeURIComponent(mail)}`
  );
  const pmid = search?.esearchresult?.idlist?.[0];
  if (!pmid) return null;
  return searchPubMed(pmid, { byId: true });
}
