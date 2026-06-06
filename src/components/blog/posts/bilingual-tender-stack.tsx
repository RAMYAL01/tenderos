import type { PostMeta } from "@/lib/blog/types";
import { Lead, H2, P, UL, Callout, Code } from "@/components/blog/article-kit";

export const meta: PostMeta = {
  slug: "bilingual-tender-stack-rtl-ltr",
  title: "The Bilingual Tender Stack: Why RTL/LTR Token Merging Breaks Standard PDF Parsers — and How We Fixed It",
  description:
    "Middle Eastern tenders mix Arabic (RTL) and English (LTR) on the same line, span tables across 40 pages, and arrive as low-quality scans. Here is the OCR-to-structure pipeline we built to turn that mess into clean, structured BOQs.",
  excerpt:
    "Arabic/English on one line, tables across 40 pages, watermarked scans. The ingestion pipeline that turns MENA tenders into structured BOQs.",
  category: "Engineering",
  date: "2026-05-28",
  readingMinutes: 8,
  tags: ["OCR", "Arabic NLP", "Document AI"],
};

export function Body() {
  return (
    <>
      <Lead>
        A Gulf government RFP is one of the most hostile documents in enterprise software: 100+ pages, scanned at
        low quality, stamped and watermarked, with Arabic (right-to-left) and English (left-to-right) colliding on
        the same line, and Bill-of-Quantities tables that break across dozens of pages. Standard PDF parsers don&apos;t
        struggle with this — they fail at it. Here is the pipeline we built instead.
      </Lead>

      <H2>Why standard parsers scramble bilingual text</H2>
      <P>
        Text in a PDF has no inherent &ldquo;reading order&rdquo; — it is positioned glyphs. Parsers reconstruct order
        from coordinates and the Unicode bidirectional algorithm. The moment Arabic and English share a line, that
        reconstruction breaks: tokens merge in the wrong visual order, numbers attach to the wrong words, and a clause
        like &ldquo;Local content ≥ 30% — المحتوى المحلي&rdquo; comes out as unusable salad. Feed that to an LLM and you
        are now asking it to guess what the document said — exactly the kind of hallucination we refuse to ship.
      </P>

      <H2>Stage 1 — Vision OCR with spatial layout</H2>
      <P>
        We start with an enterprise OCR engine tuned for Arabic and complex tables, and we keep its{" "}
        <em>spatial</em> output — bounding boxes, per-word confidence, and table cell geometry — not just raw text.
        For 100+ page files we chunk by page range and run the jobs concurrently, with bounded exponential-backoff
        polling and per-chunk fault isolation: if one chunk fails, the rest of the document still ingests, and the
        failed range is flagged rather than silently dropped.
      </P>

      <H2>Stage 2 — Deterministic cross-page table stitching</H2>
      <P>
        A BOQ that visually spans 40 pages arrives as 40 disconnected table fragments. Re-assembling them is a
        deterministic geometry problem, not an AI one. We fingerprint each fragment by its{" "}
        <strong>column x-anchors</strong> (normalized to page width) and judge continuation by five conditions:
      </P>
      <UL>
        <li>the pages are adjacent;</li>
        <li>the column counts match;</li>
        <li>the per-column anchors align within tolerance;</li>
        <li>the upper fragment ends near the bottom of its page; and</li>
        <li>the lower fragment starts near the top of the next.</li>
      </UL>
      <P>
        When a continuation repeats the header row, we detect and drop it. The result is one logical table —
        reproducibly, with the same OCR input always producing the same stitched output.
      </P>

      <H2>Stage 3 — De-noising &amp; structuring</H2>
      <P>
        Only now does a language model enter, and only to clean and structure — never to invent. It repairs
        mis-merged RTL/LTR tokens into logical reading order, ignores page numbers, repeated headers/footers, and
        watermarks, and emits a strict schema: clause id, original Arabic text, English equivalent, and whether the
        clause is a mandatory compliance item. A forced tool schema means the model literally cannot return prose or
        prices.
      </P>
      <Code>{`{
  "clause_id": "3.2.1",
  "original_arabic_text": "يجب أن يمتلك المقاول شهادة الأيزو 9001",
  "english_translation_or_equivalent": "The contractor must hold ISO 9001 certification",
  "is_mandatory_compliance_item": true
}`}</Code>

      <H2>Fault tolerance: flag, don&apos;t guess</H2>
      <P>
        The cardinal rule of the pipeline is that it must never silently emit garbage. Low page-level confidence, an
        unreadable table, an ambiguous stitch, or a column-count mismatch each raises a structured review flag with a
        reason and a page reference, and holds the document for a human instead of passing bad data downstream to the
        pricing engine.
      </P>

      <Callout title="Extraction is probabilistic. The output contract isn't.">
        The model does the one thing it&apos;s good at — reading a messy, bilingual scan — inside hard guardrails:
        deterministic stitching before it, a forced schema around it, and confidence-based human review after it.
      </Callout>
    </>
  );
}
