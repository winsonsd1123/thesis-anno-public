export const ACADEMIC_FETCH_TIMEOUT_MS = 15_000;

export function politeUserAgent(): string {
  const mail =
    process.env.ACADEMIC_API_CONTACT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
    "support@example.com";
  return `ThesisAnno/1.0 (mailto:${mail})`;
}

export function semanticScholarHeaders(): HeadersInit {
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  const h: Record<string, string> = { "User-Agent": politeUserAgent() };
  if (key) h["x-api-key"] = key;
  return h;
}

async function doFetch(url: string, init?: RequestInit): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ACADEMIC_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": politeUserAgent(),
        ...(init?.headers as Record<string, string>),
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  let res = await doFetch(url, init);
  if (res?.status === 429) {
    console.warn(`[academic] 429 rate-limit from ${new URL(url).hostname}, retrying after 2s…`);
    await new Promise((r) => setTimeout(r, 2_000));
    res = await doFetch(url, init);
  }
  if (!res?.ok) return null;
  return (await res.json()) as T;
}
