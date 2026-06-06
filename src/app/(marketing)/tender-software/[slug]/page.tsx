import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileSearch, Languages, Calculator, ShieldCheck, Brain, Workflow } from "lucide-react";
import { allCombos, getCombo, type Combo } from "@/lib/seo/programmatic-data";
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

// Build only the (industry × country) matrix; any other slug 404s.
export const dynamicParams = false;
export function generateStaticParams() {
  return allCombos().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const combo = getCombo(slug);
  if (!combo) return {};
  const { industry, country } = combo;
  const title = `${industry.name} Tender & BOQ Software in ${country.name}`;
  const description = `TenderOS helps ${industry.noun} in ${country.name} extract Arabic/English RFPs and BOQs in 90 seconds and price bids with a deterministic, float-safe engine — aligned with ${country.localContent}.`;
  const url = `${SITE}/tender-software/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: `/tender-software/${slug}` },
    openGraph: { type: "website", url, title: `${title} | TenderOS`, description, siteName: "TenderOS", locale: "en_US" },
  };
}

export default async function ProgrammaticSolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const combo = getCombo(slug);
  if (!combo) notFound();
  const { industry, country } = combo;

  const faqs = buildFaqs(combo);

  return (
    <SolutionShell>
      <JsonLd data={softwareJsonLd(combo)} />
      <JsonLd data={breadcrumbJsonLd(combo)} />
      <JsonLd data={faqJsonLd(faqs)} />

      <SolutionHero
        eyebrow={`Tender Software · ${country.name}`}
        title={
          <>
            {industry.name} Tender &amp; BOQ Software for{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              {country.name}
            </span>
          </>
        }
        subtitle={`Built for ${industry.noun} bidding through ${country.portal}: turn a 100-page scanned Arabic/English RFP into a structured compliance matrix in 90 seconds, then price the BOQ in ${country.currency} with an engine that never hallucinates a number.`}
      />

      <PainSolution
        title={`Why ${industry.name.toLowerCase() === "epc" ? "EPC" : industry.name.toLowerCase()} bid desks in ${country.name} switch to TenderOS`}
        rows={[
          {
            pain: `Estimators retype ${industry.pain} by hand for days.`,
            danger: "Transcription errors, missed mandatory clauses, blown deadlines.",
            solution:
              "Enterprise OCR + cross-page table stitching reconstructs every BOQ line and clause — Arabic (RTL) and English (LTR) — in about 90 seconds.",
          },
          {
            pain: "Generic AI tools 'estimate' prices and hallucinate totals.",
            danger: `A wrong number in your ${country.currency} bid means winning at a loss — or losing on a figure the AI invented.`,
            solution:
              "A deterministic, float-safe engine computes every figure from your own labor & material rates. The AI extracts; it never sets a price.",
          },
          {
            pain: `Compliance with ${country.localContent} is tracked in spreadsheets.`,
            danger: "Local-content gaps surface after submission — when it's too late.",
            solution:
              "Auto-built compliance matrix maps each requirement to your capability and flags gaps before you submit.",
          },
        ]}
      />

      <FeatureGrid
        title={`Everything a ${country.name} bid team needs`}
        features={[
          { icon: FileSearch, title: "RFP & BOQ Extraction", body: `Ingest scanned, watermarked PDFs from ${country.portal} and get structured requirements and BOQ lines fast.` },
          { icon: Languages, title: "Bilingual by Design", body: "Arabic and English on the same line — RTL/LTR handled, not broken like standard parsers." },
          { icon: Calculator, title: "Deterministic Pricing", body: `Float-safe arithmetic in ${country.currency} from your internal rate cards. 100% reproducible, audit-ready.` },
          { icon: ShieldCheck, title: "Compliance Matrix", body: `Track mandatory clauses and ${country.localContent} coverage with AI gap analysis.` },
          { icon: Brain, title: "Corporate Knowledge Brain", body: "Search your past proposals, ISO certs, and CVs — tenant-isolated, never used to train external models." },
          { icon: Workflow, title: "ERP Integration", body: "Sync vendor and material catalogues from SAP/Oracle and push awarded tenders back as webhooks." },
        ]}
      />

      <FaqSection title={`${industry.name} tendering in ${country.name} — FAQ`} items={faqs} />

      <SolutionCta
        title={`Win more tenders in ${country.name}`}
        subtitle="Start a 14-day free trial — no credit card required."
      />
    </SolutionShell>
  );
}

// ── content + structured data ─────────────────────────────────────────────────

function buildFaqs(combo: Combo): FaqItem[] {
  const { industry, country } = combo;
  return [
    {
      q: `Can TenderOS read scanned Arabic RFPs and BOQs from ${country.portal}?`,
      a: `Yes. TenderOS uses enterprise OCR tuned for Arabic and complex tables, with cross-page stitching, so even a 100+ page scanned bilingual tender is structured into requirements and BOQ line items in about 90 seconds.`,
    },
    {
      q: `How does TenderOS guarantee pricing accuracy for ${industry.noun}?`,
      a: `Pricing is computed by a deterministic, float-safe engine using your own labor and material rates in ${country.currency}. The AI never sets a price, so there is zero math hallucination and every total is reproducible and audit-ready.`,
    },
    {
      q: `Does it help with ${country.localContent}?`,
      a: `Yes. The compliance matrix maps each tender requirement — including local-content thresholds — to your capabilities and flags gaps before submission.`,
    },
    {
      q: `Is our bid data kept private?`,
      a: `Every tenant is isolated at the data layer, and your data is never used to train external LLMs. You can also sync rates from your ERP and push awarded tenders back via webhooks.`,
    },
  ];
}

function softwareJsonLd(combo: Combo) {
  const { industry, country } = combo;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `TenderOS — ${industry.name} Tender Software in ${country.name}`,
    url: `${SITE}/tender-software/${combo.slug}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web (Cloud / SaaS)",
    inLanguage: ["en", "ar"],
    description: `Tender intelligence and deterministic BOQ pricing for ${industry.noun} in ${country.name}.`,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "14-day free trial" },
    publisher: { "@type": "Organization", name: "TenderOS", url: SITE },
  };
}

function breadcrumbJsonLd(combo: Combo) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Tender Software", item: `${SITE}/tender-software` },
      { "@type": "ListItem", position: 2, name: `${combo.industry.name} in ${combo.country.name}`, item: `${SITE}/tender-software/${combo.slug}` },
    ],
  };
}
