/** 统一供 LLM 裁判使用的候选结构 */
export type ReferenceCandidate = {
  source: "crossref" | "openalex" | "semantic_scholar" | "pubmed" | "arxiv";
  title: string | null;
  authors: string[] | null;
  year: number | null;
  doi: string | null;
  venue: string | null;
};
