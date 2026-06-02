/**
 * DOCX text extraction using mammoth.
 *
 * Mammoth converts Word documents to clean plain text,
 * stripping formatting while preserving paragraph structure.
 */

export interface DocxExtractionResult {
  fullText: string;
  pages: Array<{ page: number; text: string }>;
  pageCount: number;
  warnings: string[];
}

/**
 * Extract text from a DOCX buffer.
 *
 * DOCX files don't have native page breaks in their XML structure —
 * we approximate pages by splitting on double newlines and grouping.
 */
export async function extractDocxText(
  buffer: Buffer
): Promise<DocxExtractionResult> {
  const mammoth = await import("mammoth");

  const result = await mammoth.extractRawText({ buffer });

  const fullText = result.value?.trim() ?? "";
  const warnings = result.messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  // Approximate page count:
  // Average English page ≈ 3,000 characters of plain text
  const CHARS_PER_PAGE = 3000;
  const estimatedPageCount = Math.max(
    1,
    Math.ceil(fullText.length / CHARS_PER_PAGE)
  );

  // Split into approximate pages for compatibility with PDF result format
  const pages: Array<{ page: number; text: string }> = [];
  for (let i = 0; i < estimatedPageCount; i++) {
    const start = i * CHARS_PER_PAGE;
    const end = Math.min(start + CHARS_PER_PAGE, fullText.length);
    pages.push({
      page: i + 1,
      text: fullText.slice(start, end).trim(),
    });
  }

  return {
    fullText,
    pages,
    pageCount: estimatedPageCount,
    warnings,
  };
}

/**
 * Extract text from a plain .txt buffer.
 */
export function extractTxtText(buffer: Buffer): DocxExtractionResult {
  const fullText = buffer.toString("utf-8").trim();
  const CHARS_PER_PAGE = 3000;
  const estimatedPageCount = Math.max(
    1,
    Math.ceil(fullText.length / CHARS_PER_PAGE)
  );

  const pages = [];
  for (let i = 0; i < estimatedPageCount; i++) {
    const start = i * CHARS_PER_PAGE;
    const end = Math.min(start + CHARS_PER_PAGE, fullText.length);
    pages.push({ page: i + 1, text: fullText.slice(start, end).trim() });
  }

  return { fullText, pages, pageCount: estimatedPageCount, warnings: [] };
}
