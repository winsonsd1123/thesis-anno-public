import { searchArxiv } from "./arxiv";
import { searchCrossRefByDoi, searchCrossRefByTitle } from "./crossref";
import { searchOpenAlex } from "./openalex";
import { searchPubMed } from "./pubmed";
import { searchSemanticScholar } from "./semantic-scholar";
import type { ReferenceCandidate } from "./types";
import {
  isPrimarilyCjkTitle,
  isUrlReferenceWithoutScholarIdentifiers,
  titlesExactMatchNormalized,
} from "./title-normalize";

/**
 * 标题检索：仅当返回条目标题与引用条目标题归一化后完全一致才采纳，否则视为未命中并继续瀑布。
 */
async function firstTitleSearchExactTitle(
  expectedTitle: string,
  search: () => Promise<ReferenceCandidate | null>
): Promise<ReferenceCandidate | null> {
  const cand = await search();
  if (!cand || !titlesExactMatchNormalized(expectedTitle, cand.title)) return null;
  return cand;
}

/** 中文题录：标题检索仅 CrossRef → OpenAlex（题名归一化须与引用完全一致）。 */
async function titleSearchCrossRefOpenAlexOnly(t: string): Promise<ReferenceCandidate | null> {
  let candidate = await firstTitleSearchExactTitle(t, () => searchCrossRefByTitle(t));
  if (candidate) return candidate;
  return firstTitleSearchExactTitle(t, () => searchOpenAlex(t));
}

/**
 * DOI / PMID 优先，再按标题瀑布降级。
 * - 题录以中文等 CJK 为主：仅 CrossRef → OpenAlex；
 * - 否则：CrossRef → OpenAlex → Semantic Scholar → PubMed → ArXiv（与 Tech Spec 3.5 英文路径一致）。
 */
export async function searchSourcesWaterfall(ref: {
  title: string;
  rawText: string;
}): Promise<ReferenceCandidate | null> {
  const raw = ref.rawText;
  const doiMatch = raw.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
  if (doiMatch) {
    const c = await searchCrossRefByDoi(doiMatch[0]);
    if (c && titlesExactMatchNormalized(ref.title, c.title)) return c;
  }

  const pmidMatch = raw.match(/PMID[:\s]*(\d+)/i);
  if (pmidMatch) {
    const c = await searchPubMed(pmidMatch[1], { byId: true });
    if (c && titlesExactMatchNormalized(ref.title, c.title)) return c;
  }

  if (isUrlReferenceWithoutScholarIdentifiers(raw, ref.title)) {
    return null;
  }

  const t = ref.title;
  if (isPrimarilyCjkTitle(ref.title)) {
    return titleSearchCrossRefOpenAlexOnly(t);
  }

  let candidate = await titleSearchCrossRefOpenAlexOnly(t);
  if (candidate) return candidate;

  candidate = await firstTitleSearchExactTitle(t, () => searchSemanticScholar(t));
  if (candidate) return candidate;

  candidate = await firstTitleSearchExactTitle(t, () => searchPubMed(t));
  if (candidate) return candidate;

  candidate = await firstTitleSearchExactTitle(t, () => searchArxiv(t));
  return candidate;
}
