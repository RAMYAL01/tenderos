import type { PostMeta } from "@/lib/blog/types";
import { Lead, H2, P, UL, Callout } from "@/components/blog/article-kit";

export const meta: PostMeta = {
  slug: "ocr-scanned-bilingual-government-tenders",
  title: "Stop Retyping Scanned RFPs: OCR Built for Arabic/English Government Tenders",
  description:
    "Most government tenders in the Gulf arrive as low-quality, stamped, bilingual scans that standard tools reject outright. Here's how TenderOS turns them into structured requirements — and why it refuses to guess when a scan is too poor.",
  excerpt:
    "Gulf tenders arrive as stamped, bilingual scans standard tools reject. How TenderOS OCRs them into structured data — and flags what it can't read.",
  category: "Product",
  date: "2026-06-04",
  readingMinutes: 6,
  tags: ["OCR", "Document AI", "Procurement"],
};

export function Body() {
  return (
    <>
      <Lead>
        Ask any bid manager in Riyadh, Doha, or Cairo how a tender actually arrives and the answer is rarely a
        clean digital file. It&apos;s a 120-page PDF that was printed, stamped, signed, scanned at an angle, and
        emailed — with Arabic and English sharing the same lines. Most software simply rejects it. We built the
        opposite.
      </Lead>

      <H2>Why scanned tenders break normal tools</H2>
      <P>
        A &ldquo;scanned&rdquo; PDF has no text layer — it&apos;s a picture of a page. Standard PDF parsers read the
        (non-existent) text and return nothing, so the document is either silently empty or hard-rejected. Add the
        Gulf reality — watermarks, official stamps, skew, and bidirectional Arabic/English — and even tools that do
        run OCR tend to scramble the reading order into unusable text.
      </P>

      <H2>What TenderOS does instead</H2>
      <P>
        When a document has no extractable text, we route it through an enterprise OCR engine (Azure Document
        Intelligence) tuned for Arabic and complex tables — keeping the <em>spatial</em> output, not just raw
        characters:
      </P>
      <UL>
        <li><strong>Layout-aware OCR</strong> — bounding boxes and per-word confidence, page by page.</li>
        <li><strong>Bilingual reading order</strong> — mixed RTL/LTR lines are reconstructed into logical order rather than merged into salad.</li>
        <li><strong>Cross-page table stitching</strong> — a BOQ that spans 40 pages is reassembled into one logical table by fingerprinting its columns.</li>
        <li><strong>Structured output</strong> — requirements and clauses, each tagged mandatory or informational, traceable back to the source page.</li>
      </UL>

      <H2>The part most vendors skip: knowing when to stop</H2>
      <P>
        OCR is probabilistic. A coffee-stained photocopy will produce low-confidence text, and a confidently-wrong
        requirement is worse than no requirement at all. So the pipeline tracks confidence and, when a page or
        table falls below threshold, it <em>flags the document for human review</em> with a reason and a page
        reference instead of passing bad data downstream to pricing or compliance.
      </P>

      <Callout title="Flag, don't guess.">
        If the scan is too poor to read reliably, TenderOS tells you exactly which pages are uncertain — rather than
        quietly inventing a number you&apos;d only discover was wrong at bid submission.
      </Callout>

      <H2>What this means for your bid team</H2>
      <P>
        The two or three days a coordinator spends retyping a scanned tender collapse into minutes of automated
        ingestion plus a short human pass on anything flagged. The output is structured, bilingual, and traceable —
        ready to drive the compliance matrix and the BOQ, with no silent corruption in between.
      </P>
    </>
  );
}
