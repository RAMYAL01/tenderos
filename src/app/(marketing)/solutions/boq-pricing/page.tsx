import type { Metadata } from "next";
import { Calculator, ShieldCheck, FileSpreadsheet, Workflow, Lock, GitCompare } from "lucide-react";
import {
  SolutionShell,
  SolutionHero,
  PainSolution,
  FeatureGrid,
  FaqSection,
  SolutionCta,
  RelatedLinks,
  JsonLd,
  faqJsonLd,
  type FaqItem,
} from "@/components/marketing/solution-toolkit";
import { featuredCombos, comboLabel, comboHref } from "@/lib/seo/programmatic-data";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export const metadata: Metadata = {
  title: "Automated BOQ Pricing Software — Deterministic & Float-Safe",
  description:
    "Price Bills of Quantities with a deterministic, float-safe engine driven by your own labor and material rates. Zero AI math hallucination — every total is exact, reproducible, and audit-ready. Built for construction, EPC & FM firms in MENA.",
  alternates: { canonical: "/solutions/boq-pricing" },
  openGraph: {
    type: "website",
    url: `${SITE}/solutions/boq-pricing`,
    title: "Automated BOQ Pricing Software — Deterministic & Float-Safe | TenderOS",
    description:
      "A pricing engine that is mathematically incapable of hallucinating a number. Built from your internal rate cards.",
    siteName: "TenderOS",
  },
};

const FAQS: FaqItem[] = [
  {
    q: "Why can't I just use ChatGPT to price a BOQ?",
    a: "Because pricing is a financial-controls problem, not a text-generation one. LLMs produce non-reproducible numbers, drift on floating-point arithmetic, and will confidently invent unit rates or totals. TenderOS uses the AI only to extract structure; all money is computed by a deterministic integer-exact engine from your own rates.",
  },
  {
    q: "What does 'float-safe' actually mean?",
    a: "IEEE-754 floating point silently corrupts currency (e.g. naive rounding of 1.005 under-rounds to 1.00). Our engine performs every calculation in integer minor units (BigInt), so results are exact at any magnitude with no drift, and rounding is explicit and consistent.",
  },
  {
    q: "Where do the unit rates come from?",
    a: "From your own labor-rate and material-cost catalogues, synced from Excel or your ERP (SAP/Oracle). The AI never sets or guesses a price — it only maps BOQ line items to your internal rates.",
  },
  {
    q: "Is the pricing auditable?",
    a: "Yes. Every figure is a pure arithmetic function of your entered quantities and rates and your overhead/contingency/profit/VAT assumptions. Same inputs always produce the same outputs — fully reproducible for commercial review.",
  },
];

export default function BoqPricingPillar() {
  return (
    <SolutionShell>
      <JsonLd data={softwareJsonLd()} />
      <JsonLd data={faqJsonLd(FAQS)} />

      <SolutionHero
        eyebrow="Financial Proposal Engine"
        title={
          <>
            BOQ Pricing That{" "}
            <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
              Never Hallucinates
            </span>
          </>
        }
        subtitle="Price your Bill of Quantities with a deterministic, float-safe engine driven entirely by your own labor and material rates. The AI extracts the structure; it never sets a number. Every total is exact, reproducible, and audit-ready."
      />

      <PainSolution
        title="Generic AI pricing is a commercial liability"
        rows={[
          {
            pain: "LLM 'estimators' return a confident but wrong grand total.",
            danger: "You submit a price you can't defend — winning at a loss or losing on an invented figure.",
            solution: "Integer-exact arithmetic from your rate cards. The model has no path to set a price.",
          },
          {
            pain: "Floating-point math silently mis-rounds currency.",
            danger: "Cumulative drift across thousands of BOQ lines moves the bottom line by real money.",
            solution: "All math runs in integer minor units (BigInt) — zero drift, deterministic half-up rounding.",
          },
          {
            pain: "Spreadsheets diverge from the approved rate book.",
            danger: "Estimators price off stale numbers; nobody can reproduce last quarter's total.",
            solution: "One synced rate catalogue (Excel/ERP); same inputs always reproduce the same priced output.",
          },
        ]}
      />

      <FeatureGrid
        title="A pricing engine built like a financial control"
        features={[
          { icon: Calculator, title: "Deterministic Cost Build-Up", body: "Direct cost → overhead → contingency → profit → VAT, each an explicit, documented step." },
          { icon: ShieldCheck, title: "Zero AI in the Money Path", body: "The LLM maps line items to rates; arithmetic is pure code. No estimation, no inference, no hallucination." },
          { icon: FileSpreadsheet, title: "Your Rates, Synced", body: "Import labor and material costs from Excel or your ERP and price every bid against the approved book." },
          { icon: GitCompare, title: "Reproducible & Auditable", body: "Same quantities + rates + assumptions always yield the same total — ready for commercial review." },
          { icon: Workflow, title: "Export & Push", body: "Generate a clean priced commercial DOCX and push awarded tenders to your ERP via webhooks." },
          { icon: Lock, title: "Tenant-Isolated", body: "Your rates and margins are isolated at the data layer and never used to train external models." },
        ]}
      />

      <FaqSection title="BOQ pricing — straight answers" items={FAQS} />

      <RelatedLinks
        title="Tender software by industry & region"
        links={[
          { label: "Tender & BOQ Extraction", href: "/solutions/tender-extraction" },
          ...featuredCombos().map((c) => ({ label: comboLabel(c), href: comboHref(c) })),
        ]}
      />

      <SolutionCta title="Price your next BOQ with confidence" subtitle="Start a 14-day free trial — no credit card required." />
    </SolutionShell>
  );
}

function softwareJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "TenderOS Financial Proposal Engine",
    url: `${SITE}/solutions/boq-pricing`,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "BOQ / Construction Estimating Software",
    operatingSystem: "Web (Cloud / SaaS)",
    description:
      "Deterministic, float-safe BOQ pricing driven by a company's internal labor and material rates, with zero AI math hallucination.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "14-day free trial" },
    publisher: { "@type": "Organization", name: "TenderOS", url: SITE },
  };
}
