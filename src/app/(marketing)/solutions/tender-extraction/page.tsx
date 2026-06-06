import type { Metadata } from "next";
import { FileSearch, Languages, Table, ScanLine, AlertTriangle, ListChecks } from "lucide-react";
import {
  SolutionShell,
  SolutionHero,
  PainSolution,
  FeatureGrid,
  FaqSection,
  SolutionCta,
  JsonLd,
  faqJsonLd,
  type FaqItem,
} from "@/components/marketing/solution-toolkit";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export const metadata: Metadata = {
  title: "Automated RFP & BOQ Extraction Software (Arabic + English)",
  description:
    "Turn 100+ page scanned, bilingual Arabic/English RFPs and BOQs into structured requirements and a compliance matrix in 90 seconds. Cross-page table stitching, RTL/LTR handling, and human-review flagging for low-confidence pages.",
  alternates: { canonical: "/solutions/tender-extraction" },
  openGraph: {
    type: "website",
    url: `${SITE}/solutions/tender-extraction`,
    title: "Automated RFP & BOQ Extraction Software (Arabic + English) | TenderOS",
    description:
      "Solve the Messy PDF Problem: structured requirements and BOQ lines from scanned bilingual tenders in 90 seconds.",
    siteName: "TenderOS",
  },
};

const FAQS: FaqItem[] = [
  {
    q: "Can it handle scanned PDFs with watermarks and stamps?",
    a: "Yes. TenderOS runs enterprise OCR tuned for Arabic and complex tables, ignores repetitive headers/footers, page numbers, and watermarks, and reconstructs the underlying requirements and BOQ structure.",
  },
  {
    q: "How does it deal with Arabic (RTL) and English (LTR) on the same line?",
    a: "Standard parsers scramble bidirectional text. Our pipeline normalizes reading order and a structuring step repairs mis-merged RTL/LTR tokens, so mixed-language clauses come out clean.",
  },
  {
    q: "What happens to BOQ tables that break across pages?",
    a: "A deterministic stitching step fingerprints each table's columns and re-assembles fragments across page breaks — dropping repeated headers — before anything is structured or priced.",
  },
  {
    q: "What if the OCR can't read a table reliably?",
    a: "It is flagged for human review instead of silently producing garbage. Low-confidence pages, unreadable tables, and ambiguous stitches are surfaced with reasons so a person can resolve them.",
  },
];

export default function TenderExtractionPillar() {
  return (
    <SolutionShell>
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <SolutionHero
        eyebrow="Tender Intelligence"
        title={
          <>
            Structured Requirements From a{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Messy 100-Page PDF
            </span>{" "}
            in 90 Seconds
          </>
        }
        subtitle="Upload a scanned, bilingual Arabic/English RFP or BOQ and get every requirement, clause, and line item structured into a compliance matrix — with cross-page table stitching and human-review flagging built in."
      />

      <PainSolution
        title="The Messy PDF Problem, solved"
        rows={[
          {
            pain: "A bid manager spends 2–3 days retyping a scanned tender.",
            danger: "Extraction eats the timeline; mandatory clauses get missed.",
            solution: "Enterprise OCR + structuring returns requirements and BOQ lines in about 90 seconds.",
          },
          {
            pain: "Arabic and English collide on the same row.",
            danger: "Standard parsers scramble the text and corrupt the BOQ.",
            solution: "RTL/LTR reading order is normalized and mis-merged tokens are repaired automatically.",
          },
          {
            pain: "Tables break across 40 pages.",
            danger: "Fragmented tables can't be priced or compared.",
            solution: "Deterministic column-fingerprint stitching re-assembles them across page breaks.",
          },
        ]}
      />

      <FeatureGrid
        title="An ingestion pipeline built for MENA tenders"
        features={[
          { icon: ScanLine, title: "Enterprise OCR", body: "Strong Arabic + complex-table OCR with spatial layout (bounding boxes), chunked for 100+ page files." },
          { icon: Languages, title: "Bilingual De-noising", body: "Fixes scrambled RTL/LTR token merging; ignores page numbers, headers, footers, and watermarks." },
          { icon: Table, title: "Cross-Page Table Stitching", body: "Reassembles BOQ tables across page breaks deterministically, dropping repeated headers." },
          { icon: ListChecks, title: "Compliance Matrix", body: "Every requirement extracted, tagged mandatory/optional, and mapped to your capabilities." },
          { icon: AlertTriangle, title: "Human-Review Flagging", body: "Low-confidence pages and unreadable tables are flagged for review — never silently passed downstream." },
          { icon: FileSearch, title: "Traceable to Source", body: "Each requirement links back to its source clause and page for fast verification." },
        ]}
      />

      <FaqSection title="RFP & BOQ extraction — straight answers" items={FAQS} />

      <SolutionCta title="Stop retyping tenders" subtitle="Start a 14-day free trial — no credit card required." />
    </SolutionShell>
  );
}

function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderOS Tender Intelligence",
    url: `${SITE}/solutions/tender-extraction`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "RFP / BOQ Extraction Software",
    operatingSystem: "Web (Cloud / SaaS)",
    inLanguage: ["en", "ar"],
    description:
      "Extract requirements and compliance matrices from scanned, bilingual Arabic/English RFPs and BOQs, with cross-page table stitching and human-review flagging.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "14-day free trial" },
    publisher: { "@type": "Organization", name: "TenderOS", url: SITE },
  };
}
