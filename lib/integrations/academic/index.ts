/**
 * 学术元数据检索：按数据源拆分模块，本文件聚合导出。
 * CrossRef Polite Pool：User-Agent 须含 mailto（见 ./http.ts）
 */

export type { ReferenceCandidate } from "./types";

export {
  isPrimarilyCjkTitle,
  isUrlReferenceWithoutScholarIdentifiers,
  normalizeTitleForExactMatch,
  titlesExactMatchNormalized,
} from "./title-normalize";

export { searchCrossRefByDoi, searchCrossRefByTitle } from "./crossref";
export { searchOpenAlex } from "./openalex";
export { searchSemanticScholar } from "./semantic-scholar";
export { searchPubMed } from "./pubmed";
export { searchArxiv } from "./arxiv";

export { searchSourcesWaterfall } from "./waterfall";
