/**
 * DOCX Export Engine
 *
 * Generates professional Word documents from TenderOS proposals.
 * Uses the `docx` npm package (pure JS, works in Vercel serverless).
 *
 * Features:
 * - Cover page with tender + client info
 * - Bilingual support (Arabic RTL + English LTR)
 * - Section headings, paragraphs, bullet lists
 * - Professional typography
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, BorderStyle, convertInchesToTwip,
  Header, Footer, PageNumber,
} from "docx";

export interface ProposalForExport {
  title: string;
  language: string;
  tender: {
    titleEn: string;
    titleAr?: string | null;
    clientName?: string | null;
    referenceNo?: string | null;
    tenderType?: string | null;
  };
  sections: Array<{
    sectionType: string;
    titleEn?: string | null;
    titleAr?: string | null;
    contentEn?: string | null;
    contentAr?: string | null;
    orderIndex: number;
  }>;
  exportedAt: string;
  companyName?: string;
}

/**
 * Generate a Word document from proposal data.
 * Returns a Buffer containing the .docx file.
 */
export async function generateDocx(proposal: ProposalForExport): Promise<Buffer> {
  const isArabic = proposal.language === "AR" ||
                   proposal.language === "AR_SA" ||
                   proposal.language === "AR_AE" ||
                   proposal.language === "AR_EG";
  const isBilingual = proposal.language === "BILINGUAL";

  const sections = proposal.sections
    .filter((s) => s.contentEn || s.contentAr)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // ── Document children ──────────────────────────────────────────────────────
  const children: Paragraph[] = [];

  // Cover page
  children.push(
    new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } })
  );
  children.push(
    new Paragraph({
      text: proposal.companyName ?? "COMPANY NAME",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(2), after: 200 },
    })
  );
  children.push(
    new Paragraph({
      text: "TECHNICAL PROPOSAL",
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    })
  );
  children.push(
    new Paragraph({
      text: proposal.tender.titleEn.toUpperCase(),
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 400 },
      children: [
        new TextRun({
          text: proposal.tender.titleEn.toUpperCase(),
          bold: true,
          size: 28,
        }),
      ],
    })
  );

  if (proposal.tender.titleAr) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [
          new TextRun({
            text: proposal.tender.titleAr,
            bold: true,
            size: 24,
            rightToLeft: true,
          }),
        ],
      })
    );
  }

  // Cover info block
  const coverLines: string[] = [];
  if (proposal.tender.clientName) coverLines.push(`Client: ${proposal.tender.clientName}`);
  if (proposal.tender.referenceNo) coverLines.push(`Reference: ${proposal.tender.referenceNo}`);
  if (proposal.tender.tenderType) coverLines.push(`Type: ${proposal.tender.tenderType}`);
  coverLines.push(`Date: ${new Date(proposal.exportedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`);

  for (const line of coverLines) {
    children.push(
      new Paragraph({
        text: line,
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
      })
    );
  }

  // Page break before content
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Sections ───────────────────────────────────────────────────────────────
  for (const section of sections) {
    const sectionTitle =
      section.titleEn ??
      section.sectionType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

    // Section heading
    children.push(
      new Paragraph({
        text: sectionTitle,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        pageBreakBefore: section.orderIndex > 0,
      })
    );

    if (section.titleAr && isBilingual) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.titleAr, bold: true, rightToLeft: true })],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 200 },
        })
      );
    }

    // English content
    if (section.contentEn) {
      const enParagraphs = htmlToParagraphs(section.contentEn, false);
      children.push(...enParagraphs);
    }

    // Arabic content (bilingual)
    if (isBilingual && section.contentAr) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "─".repeat(40), color: "CCCCCC" })],
          spacing: { before: 300, after: 300 },
        })
      );
      const arParagraphs = htmlToParagraphs(section.contentAr, true);
      children.push(...arParagraphs);
    }

    // Arabic-only mode
    if (isArabic && section.contentAr && !section.contentEn) {
      const arParagraphs = htmlToParagraphs(section.contentAr, true);
      children.push(...arParagraphs);
    }
  }

  // ── Build document ─────────────────────────────────────────────────────────
  const doc = new Document({
    creator: "TenderOS",
    title: proposal.title,
    description: `Technical proposal for ${proposal.tender.titleEn}`,
    styles: {
      default: {
        document: {
          run: {
            size: 22, // 11pt
            font: "Calibri",
          },
          paragraph: {
            spacing: { line: 276, after: 160 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1.25),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${proposal.companyName ?? "Company"} | ${proposal.tender.titleEn.slice(0, 60)}`,
                    size: 16,
                    color: "666666",
                  }),
                ],
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "666666" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "666666" }),
                  new TextRun({ text: " of ", size: 16, color: "666666" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "666666" }),
                ],
                border: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * Convert HTML string to docx Paragraph array.
 * Handles: <p>, <h1-3>, <ul>, <ol>, <li>, <strong>, <em>, <br>
 */
function htmlToParagraphs(html: string, isRTL: boolean): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Strip HTML tags and convert to structured text
  // Simple approach: split by block elements
  const cleaned = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "$1")
    .replace(/<em>(.*?)<\/em>/gi, "$1")
    .replace(/<[^>]+>/g, "") // strip remaining tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"');

  const rawParagraphs = cleaned.split(/\n\n+/);

  for (const raw of rawParagraphs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Handle bullet list items
    if (trimmed.includes("\n")) {
      const lines = trimmed.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        const lineText = line.replace(/^[-•*]\s*/, "").trim();
        if (lineText) {
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: lineText, rightToLeft: isRTL })],
              bullet: { level: 0 },
              alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
              spacing: { before: 60, after: 60 },
            })
          );
        }
      }
    } else {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              rightToLeft: isRTL,
              font: isRTL ? "Arial" : "Calibri",
              size: 22,
            }),
          ],
          alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.JUSTIFIED,
          spacing: { before: 120, after: 120 },
        })
      );
    }
  }

  return paragraphs;
}
