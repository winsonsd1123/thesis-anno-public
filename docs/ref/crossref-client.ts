/**
 * CrossRef API Client
 * - 封装 https://api.crossref.org/works
 * - 使用 Polite Pool Header: User-Agent: ThesisAnno/1.0 (mailto:...)
 */

const CROSSREF_API = "https://api.crossref.org/works";

export interface CrossrefSearchResult {
  title: string;
  authors: string[];
  year: string;
  link: string;
  source: "crossref";
}

function getUserAgent(): string {
  const email = process.env.CROSSREF_EMAIL ?? "admin@thesis-anno.com";
  return `ThesisAnno/1.0 (mailto:${email})`;
}

function parseItem(item: {
  title?: string[];
  author?: Array<{ family?: string; given?: string }>;
  published?: { "date-parts"?: number[][] };
  DOI?: string;
}): CrossrefSearchResult | null {
  const titleStr = item.title?.[0] ?? "";
  const authorList =
    item.author?.map((a) => [a.given, a.family].filter(Boolean).join(" ")) ?? [];
  const yearParts = item.published?.["date-parts"]?.[0];
  const year = yearParts?.[0]?.toString() ?? "";
  const doi = item.DOI ?? "";
  const link = doi ? `https://doi.org/${doi}` : "";
  if (!titleStr) return null;
  return { title: titleStr, authors: authorList, year, link, source: "crossref" };
}

/** 仅用标题搜索（title-only），返回最多 1 条候选 */
export async function searchCrossref(title: string): Promise<CrossrefSearchResult[]> {
  if (!title?.trim()) {
    console.log("[ref-search] CrossRef: title 为空，跳过");
    return [];
  }

  const params = new URLSearchParams({
    "query.title": title.trim(),
    rows: "1",
  });
  const url = `${CROSSREF_API}?${params.toString()}`;

  console.log("[ref-search] CrossRef 请求:", { title: title.trim().slice(0, 60), url });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": getUserAgent() },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.log("[ref-search] CrossRef HTTP 错误:", res.status);
      return [];
    }

    const json = (await res.json()) as {
      message?: { items?: Array<{ title?: string[]; author?: Array<{ family?: string; given?: string }>; published?: { "date-parts"?: number[][] }; DOI?: string }> };
    };
    const items = json.message?.items ?? [];
    const all = items.map(parseItem).filter((r): r is CrossrefSearchResult => r != null);
    console.log("[ref-search] CrossRef 返回", all.length, "条:", all.map((r) => ({ title: r.title.slice(0, 50), link: r.link })));

    return all;
  } catch (e) {
    console.log("[ref-search] CrossRef 异常:", e);
    return [];
  }
}
