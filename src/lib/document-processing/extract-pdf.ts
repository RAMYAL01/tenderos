/**
 * PDF text extraction using pdf-parse.
 *
 * Runs server-side only (Node.js runtime).
 * Handles both native text PDFs and returns metadata for scanned PDFs.
 */

export interface PdfExtractionResult {
  fullText: string;
  pages: Array<{ page: number; text: string }>;
  pageCount: number;
  isScanned: boolean;     // true if text density is very low (likely scanned)
  metadata: {
    title?: string;
    author?: string;
    creationDate?: string;
  };
}

/**
 * Extract text from a PDF buffer.
 * Uses pdf-parse under the hood.
 *
 * Note: pdf-parse has a quirk with Next.js — it tries to load a test file.
 * We work around it by using a dynamic import + providing an empty options object.
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  // Dynamic import avoids Next.js module bundling issues with pdf-parse
  const pdfParse = (await import("pdf-parse")).default;

  let pdfData: {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  };

  try {
    pdfData = await pdfParse(buffer, {
      // Disable test loading (fixes Next.js issue)
      max: 0,
    });
  } catch (err) {
    throw new Error(
      `PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const fullText = pdfData.text ?? "";
  const pageCount = pdfData.numpages ?? 0;

  // Split text by form-feed character (pdf-parse uses \f as page separator)
  const rawPages = fullText.split("\f");
  const pages = rawPages.map((text, idx) => ({
    page: idx + 1,
    text: text.trim(),
  })).filter((p) => p.page <= pageCount);

  // Detect if this is a scanned PDF (very low text density)
  const avgCharsPerPage = pageCount > 0 ? fullText.length / pageCount : 0;
  const isScanned = avgCharsPerPage < 50; // < 50 chars/page = likely scanned

  return {
    fullText: fullText.trim(),
    pages,
    pageCount,
    isScanned,
    metadata: {
      title: pdfData.info?.Title as string | undefined,
      author: pdfData.info?.Author as string | undefined,
      creationDate: pdfData.info?.CreationDate as string | undefined,
    },
  };
}
