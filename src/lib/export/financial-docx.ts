/**
 * Financial Proposal DOCX Export
 *
 * Generates a professional priced commercial proposal as a Word document:
 *   • Cover page (tender + client + currency)
 *   • Bill of Quantities — cost lines grouped by category with line totals
 *   • Cost build-up — direct cost → overhead → contingency → profit → VAT
 *   • Price schedule summary
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Every monetary value rendered here comes from `computeBreakdown` in
 * src/lib/financial/calculate.ts — a deterministic, AI-free arithmetic engine.
 * This file only LAYS OUT numbers; it never derives or invents a price.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Uses the `docx` npm package (pure JS, runs in Vercel serverless).
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, PageBreak, BorderStyle, convertInchesToTwip,
  Header, Footer, PageNumber,
  Table, TableRow, TableCell, WidthType, ShadingType,
} from "docx";
import {
  computeBreakdown,
  formatMoney,
  lineTotal,
  CATEGORY_LABELS,
  type CostLineInput,
} from "@/lib/financial/calculate";
import type { CostCategory } from "@prisma/client";

export interface FinancialLineForExport {
  category: CostCategory;
  itemRef?: string | null;
  description: string;
  unit?: string | null;
  quantity: number;
  unitRate: number;
  source?: string | null;
}

export interface FinancialForExport {
  title: string;
  currency: string;
  assumptions: {
    overheadPct: number;
    contingencyPct: number;
    profitMarginPct: number;
    vatPct: number;
  };
  lines: FinancialLineForExport[];
  tender: {
    titleEn: string;
    titleAr?: string | null;
    clientName?: string | null;
    referenceNo?: string | null;
    tenderType?: string | null;
  };
  companyName?: string;
  exportedAt: string;
}

const BRAND = "0F172A"; // navy primary
const ACCENT = "2563EB"; // blue secondary
const HEADER_BG = "0F172A";
const SUBTOTAL_BG = "EEF2FF";
const TOTAL_BG = "2563EB";

const ALL_CATEGORIES: CostCategory[] = [
  "LABOR",
  "EQUIPMENT",
  "MATERIAL",
  "SUBCONTRACTOR",
  "TRANSPORT",
  "OTHER_DIRECT",
];

export async function generateFinancialDocx(
  fin: FinancialForExport
): Promise<Buffer> {
  const currency = fin.currency || "SAR";
  const calcLines: CostLineInput[] = fin.lines.map((l) => ({
    category: l.category,
    quantity: l.quantity,
    unitRate: l.unitRate,
  }));
  const breakdown = computeBreakdown(calcLines, fin.assumptions);

  const children: (Paragraph | Table)[] = [];

  // ── Cover ───────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: fin.companyName ?? "COMPANY NAME",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(1.8), after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 300 },
      children: [
        new TextRun({ text: "FINANCIAL PROPOSAL", bold: true, size: 32, color: ACCENT }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 100 },
      children: [
        new TextRun({ text: fin.tender.titleEn.toUpperCase(), bold: true, size: 26 }),
      ],
    })
  );
  if (fin.tender.titleAr) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 300 },
        children: [
          new TextRun({ text: fin.tender.titleAr, bold: true, size: 24, rightToLeft: true }),
        ],
      })
    );
  }

  const coverLines: string[] = [];
  if (fin.tender.clientName) coverLines.push(`Client: ${fin.tender.clientName}`);
  if (fin.tender.referenceNo) coverLines.push(`Reference: ${fin.tender.referenceNo}`);
  if (fin.tender.tenderType) coverLines.push(`Type: ${fin.tender.tenderType}`);
  coverLines.push(`Currency: ${currency}`);
  coverLines.push(
    `Date: ${new Date(fin.exportedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`
  );
  for (const line of coverLines) {
    children.push(
      new Paragraph({
        text: line,
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
      })
    );
  }

  // Headline total on the cover
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({ text: "TOTAL BID PRICE (incl. VAT)", bold: true, size: 18, color: "666666" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: formatMoney(breakdown.totalPrice, currency),
          bold: true,
          size: 40,
          color: BRAND,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ── Bill of Quantities ──────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: "Bill of Quantities",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 160 },
    })
  );

  if (fin.lines.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "No cost lines have been entered.", italics: true, color: "888888" }),
        ],
        spacing: { after: 200 },
      })
    );
  } else {
    children.push(buildBoqTable(fin.lines, breakdown, currency));
  }

  // ── Cost Build-up ───────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: "Cost Build-up",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 160 },
      pageBreakBefore: true,
    }),
    buildBreakdownTable(breakdown, fin.assumptions, currency),
    new Paragraph({
      spacing: { before: 240, after: 0 },
      children: [
        new TextRun({
          text:
            "All figures are computed deterministically from the unit rates and quantities entered above and the stated assumptions. No price is estimated or generated automatically.",
          italics: true,
          size: 16,
          color: "888888",
        }),
      ],
    })
  );

  // ── Document ────────────────────────────────────────────────────────────────
  const doc = new Document({
    creator: "TenderOS",
    title: fin.title,
    description: `Financial proposal for ${fin.tender.titleEn}`,
    styles: {
      default: {
        document: {
          run: { size: 22, font: "Calibri" },
          paragraph: { spacing: { line: 276, after: 160 } },
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
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${fin.companyName ?? "Company"} | Financial Proposal | ${fin.tender.titleEn.slice(0, 50)}`,
                    size: 16,
                    color: "666666",
                  }),
                ],
                border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
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
                border: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
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

// ── Table builders ─────────────────────────────────────────────────────────────

function txt(text: string, opts: { bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: 20, after: 20 },
    children: [
      new TextRun({ text, bold: opts.bold, color: opts.color, size: opts.size ?? 18 }),
    ],
  });
}

function headerCell(text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: HEADER_BG, color: "auto" },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [txt(text, { bold: true, color: "FFFFFF", size: 18, align })],
  });
}

function bodyCell(
  text: string,
  width: number,
  align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  opts: { bold?: boolean; fill?: string; color?: string } = {}
) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    ...(opts.fill ? { shading: { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } } : {}),
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [txt(text, { align, bold: opts.bold, color: opts.color })],
  });
}

// Columns: Ref (8) | Description (38) | Unit (10) | Qty (12) | Rate (16) | Total (16)
function buildBoqTable(
  lines: FinancialLineForExport[],
  breakdown: ReturnType<typeof computeBreakdown>,
  currency: string
): Table {
  const rows: TableRow[] = [];

  rows.push(
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Ref", 8),
        headerCell("Description", 38),
        headerCell("Unit", 10, AlignmentType.CENTER),
        headerCell("Qty", 12, AlignmentType.RIGHT),
        headerCell(`Rate (${currency})`, 16, AlignmentType.RIGHT),
        headerCell(`Amount (${currency})`, 16, AlignmentType.RIGHT),
      ],
    })
  );

  for (const category of ALL_CATEGORIES) {
    const catLines = lines.filter((l) => l.category === category);
    if (catLines.length === 0) continue;

    // Category banner row
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 6,
            shading: { type: ShadingType.CLEAR, fill: SUBTOTAL_BG, color: "auto" },
            margins: { top: 50, bottom: 50, left: 80, right: 80 },
            children: [txt(CATEGORY_LABELS[category].toUpperCase(), { bold: true, color: BRAND, size: 18 })],
          }),
        ],
      })
    );

    let catTotal = 0;
    for (const l of catLines) {
      const amount = lineTotal({ quantity: l.quantity, unitRate: l.unitRate });
      catTotal += amount;
      rows.push(
        new TableRow({
          children: [
            bodyCell(l.itemRef ?? "", 8),
            bodyCell(l.description + (l.source ? `\n(${l.source})` : ""), 38),
            bodyCell(l.unit ?? "", 10, AlignmentType.CENTER),
            bodyCell(numFmt(l.quantity), 12, AlignmentType.RIGHT),
            bodyCell(numFmt(l.unitRate), 16, AlignmentType.RIGHT),
            bodyCell(numFmt(amount), 16, AlignmentType.RIGHT),
          ],
        })
      );
    }

    // Category subtotal
    rows.push(
      new TableRow({
        children: [
          bodyCell("", 8, AlignmentType.LEFT, { fill: "F8FAFC" }),
          bodyCell(`${CATEGORY_LABELS[category]} subtotal`, 38, AlignmentType.LEFT, { bold: true, fill: "F8FAFC" }),
          bodyCell("", 10, AlignmentType.CENTER, { fill: "F8FAFC" }),
          bodyCell("", 12, AlignmentType.RIGHT, { fill: "F8FAFC" }),
          bodyCell("", 16, AlignmentType.RIGHT, { fill: "F8FAFC" }),
          bodyCell(numFmt(round2(catTotal)), 16, AlignmentType.RIGHT, { bold: true, fill: "F8FAFC" }),
        ],
      })
    );
  }

  // Direct cost total
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 5,
          shading: { type: ShadingType.CLEAR, fill: HEADER_BG, color: "auto" },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [txt("TOTAL DIRECT COST", { bold: true, color: "FFFFFF", size: 18, align: AlignmentType.RIGHT })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: HEADER_BG, color: "auto" },
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          children: [txt(numFmt(breakdown.directCost), { bold: true, color: "FFFFFF", size: 18, align: AlignmentType.RIGHT })],
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders(),
    rows,
  });
}

function buildBreakdownTable(
  breakdown: ReturnType<typeof computeBreakdown>,
  assumptions: FinancialForExport["assumptions"],
  currency: string
): Table {
  const rows: TableRow[] = [];

  const line = (
    label: string,
    amount: number,
    opts: { bold?: boolean; fill?: string; color?: string; whiteText?: boolean } = {}
  ) => {
    const color = opts.whiteText ? "FFFFFF" : opts.color;
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            ...(opts.fill ? { shading: { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } } : {}),
            margins: { top: 50, bottom: 50, left: 100, right: 80 },
            children: [txt(label, { bold: opts.bold, color, size: 20 })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            ...(opts.fill ? { shading: { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } } : {}),
            margins: { top: 50, bottom: 50, left: 80, right: 100 },
            children: [txt(formatMoney(amount, currency), { bold: opts.bold, color, size: 20, align: AlignmentType.RIGHT })],
          }),
        ],
      })
    );
  };

  line("Direct Cost", breakdown.directCost, { bold: true });
  line(`Overhead (${pctLabel(assumptions.overheadPct)} of direct)`, breakdown.overhead);
  line(`Contingency (${pctLabel(assumptions.contingencyPct)} of direct + overhead)`, breakdown.contingency);
  line("Cost Before Profit", breakdown.costBeforeProfit, { bold: true, fill: SUBTOTAL_BG });
  line(`Profit (${pctLabel(assumptions.profitMarginPct)} markup)`, breakdown.profit);
  line("Net Price (ex-VAT)", breakdown.netPrice, { bold: true, fill: SUBTOTAL_BG });
  line(`VAT (${pctLabel(assumptions.vatPct)})`, breakdown.vat);
  line("TOTAL PRICE (incl. VAT)", breakdown.totalPrice, { bold: true, fill: TOTAL_BG, whiteText: true });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders(),
    rows,
  });
}

function tableBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };
  return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function numFmt(n: number): string {
  return round2(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctLabel(p: number): string {
  return `${round2(p)}%`;
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
