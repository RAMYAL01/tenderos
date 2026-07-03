import { extractPdfText } from "./extract-pdf";
import { extractDocxText, extractTxtText } from "./extract-docx";
import { ocrScannedPdf, isOcrConfigured } from "./extract-scanned-ocr";
import { detectLanguage } from "./detect-language";

export interface ExtractedContent {
  fullText: string;
  pageCount: number;
  language: string; // ARABIC | ENGLISH | BILINGUAL | UNKNOWN
  isScanned: boolean;
  method: string;
}

/**
 * Extract plain text from a document buffer, routing by MIME type. This is the
 * text-extraction half of the tender pipeline (processDocument) factored out so
 * the Knowledge Brain upload can reuse it WITHOUT creating a tender-bound
 * Document row — it returns the text directly. Throws on unsupported types,
 * un-OCR-able scans, or empty extraction.
 */
export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<ExtractedContent> {
  if (mimeType === "application/pdf") {
    const result = await extractPdfText(buffer);
    if (result.isScanned) {
      if (!isOcrConfigured()) {
        throw new Error("This looks like a scanned PDF. Upload a text-based PDF or DOCX, or enable OCR (Enterprise plan).");
      }
      const ocr = await ocrScannedPdf({ bytes: buffer, pageCount: result.pageCount });
      if (!ocr.fullText.trim()) throw new Error("OCR produced no readable text — the scan may be too low-quality.");
      return {
        fullText: ocr.fullText,
        pageCount: ocr.pageCount,
        language: detectLanguage(ocr.fullText),
        isScanned: true,
        method: ocr.provider === "claude-vision" ? "claude-ocr" : ocr.provider === "local-vision" ? "vlm-ocr" : "azure-ocr",
      };
    }
    return {
      fullText: result.fullText,
      pageCount: result.pageCount,
      language: detectLanguage(result.fullText),
      isScanned: false,
      method: "pdf-parse",
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await extractDocxText(buffer);
    return {
      fullText: result.fullText,
      pageCount: result.pageCount,
      language: detectLanguage(result.fullText),
      isScanned: false,
      method: "mammoth",
    };
  }

  if (mimeType === "text/plain") {
    const result = extractTxtText(buffer);
    return {
      fullText: result.fullText,
      pageCount: result.pageCount,
      language: detectLanguage(result.fullText),
      isScanned: false,
      method: "plaintext",
    };
  }

  throw new Error(`Unsupported file type: ${mimeType}. Upload a PDF, DOCX, or TXT.`);
}
