/**
 * Deterministic, defensive text chunker — no LangChain.
 *
 * Strategy: normalize → split into paragraphs → split over-long paragraphs on
 * sentence boundaries (incl. Arabic `؟`) → greedily pack units into windows of
 * ~maxChars with a sentence-level overlap so context isn't severed at a seam.
 * Same input always yields the same chunks (reproducible ingestion).
 */

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number; // rough estimate (chars / 4)
}

const APPROX_CHARS_PER_TOKEN = 4;

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(Number.isFinite(n) ? n : lo)));
}

function estimateTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / APPROX_CHARS_PER_TOKEN));
}

export function chunkText(
  raw: string,
  opts: { maxChars?: number; overlapChars?: number; minChars?: number } = {}
): TextChunk[] {
  const maxChars = clampInt(opts.maxChars ?? 1200, 200, 8000);
  const overlapChars = clampInt(opts.overlapChars ?? 150, 0, Math.floor(maxChars / 2));
  const minChars = clampInt(opts.minChars ?? 40, 1, maxChars);

  const text = (raw ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!text) return [];

  // 1. Paragraphs, then sentence-split anything still longer than maxChars.
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const units: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      units.push(p);
      continue;
    }
    const sentences = p.split(/(?<=[.!?؟।])\s+/);
    let buf = "";
    for (const s of sentences) {
      const candidate = buf ? `${buf} ${s}` : s;
      if (candidate.length > maxChars) {
        if (buf) units.push(buf);
        if (s.length > maxChars) {
          // Hard wrap a pathologically long sentence (e.g. an unbroken table row).
          for (let i = 0; i < s.length; i += maxChars) units.push(s.slice(i, i + maxChars));
          buf = "";
        } else {
          buf = s;
        }
      } else {
        buf = candidate;
      }
    }
    if (buf) units.push(buf);
  }

  // 2. Pack units into windows, carrying a tail overlap between windows.
  const chunks: TextChunk[] = [];
  let current = "";
  const push = (content: string) => {
    const c = content.trim();
    if (c) chunks.push({ index: chunks.length, content: c, tokenCount: estimateTokens(c) });
  };

  for (const u of units) {
    const candidate = current ? `${current}\n\n${u}` : u;
    if (current && candidate.length > maxChars) {
      push(current);
      const tail = overlapChars > 0 ? current.slice(Math.max(0, current.length - overlapChars)) : "";
      current = tail ? `${tail.trim()}\n\n${u}` : u;
    } else {
      current = candidate;
    }
  }

  // 3. Flush the tail — merge it into the previous chunk if it's too small to stand alone.
  const tail = current.trim();
  if (tail) {
    if (tail.length >= minChars || chunks.length === 0) {
      push(tail);
    } else {
      const prev = chunks[chunks.length - 1];
      prev.content = `${prev.content}\n\n${tail}`;
      prev.tokenCount = estimateTokens(prev.content);
    }
  }

  return chunks;
}
