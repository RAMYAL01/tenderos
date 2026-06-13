/**
 * Hardened fetch for ingestion adapters. Runs in the daily cron on Vercel
 * (which has network egress). Every call is bounded by a timeout and a body
 * cap so a slow or hostile source can never stall the cron or blow memory.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB cap per feed
const UA = "TenderOS-Discovery/1.0 (+https://www.thetenderos.com)";

async function fetchBounded(url: string, accept: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: accept },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);

    // Stream with a hard byte cap (don't trust Content-Length).
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new Error(`Feed exceeded ${MAX_BYTES} byte cap: ${url}`);
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
  } finally {
    clearTimeout(timer);
  }
}

export function fetchText(url: string): Promise<string> {
  return fetchBounded(url, "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8");
}

export async function fetchJson<T = unknown>(url: string): Promise<T> {
  const text = await fetchBounded(url, "application/json, */*;q=0.8");
  return JSON.parse(text) as T;
}

/** Decode the handful of XML entities that appear in feed text. */
export function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, " ") // strip any residual tags from descriptions
    .replace(/\s+/g, " ")
    .trim();
}
