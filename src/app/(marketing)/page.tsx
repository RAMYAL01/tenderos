import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/marketing/navbar";
import { ScrollProgress } from "@/components/marketing/scroll-progress";
import { Hero } from "@/components/marketing/hero";
import { LogoMarquee } from "@/components/marketing/logo-marquee";
import { Features } from "@/components/marketing/features";
import { FeatureShowcase } from "@/components/marketing/feature-showcase";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { StatsBand } from "@/components/marketing/stats-band";
import { Testimonials } from "@/components/marketing/testimonials";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/cta-section";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "TenderOS — The Operating System for Winning Contracts",
  description:
    "AI-powered bilingual proposal intelligence for government contractors. Upload RFPs, extract requirements, and generate winning proposals 10x faster.",
};

/**
 * Marketing landing page.
 * If user is already signed in, redirect straight to dashboard.
 */
export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildLandingJsonLd()) }}
      />
      <ScrollProgress />
      <Navbar />
      <main>
        <Hero />
        <LogoMarquee />
        <Features />
        <FeatureShowcase />
        <HowItWorks />
        <StatsBand />
        <Testimonials />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}

/**
 * Structured data for the homepage: an Organization + the SoftwareApplication.
 * No fabricated aggregateRating — only verifiable claims, to stay penalty-safe.
 */
function buildLandingJsonLd() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "TenderOS",
        url: siteUrl,
        logo: `${siteUrl}/icon.svg`,
        email: "support@thetenderos.com",
        description:
          "TenderOS is an AI tender-intelligence platform for construction, EPC, and facility-management firms across the MENA region.",
        areaServed: [
          { "@type": "Country", name: "Saudi Arabia" },
          { "@type": "Country", name: "United Arab Emirates" },
          { "@type": "Country", name: "Qatar" },
          { "@type": "Country", name: "Egypt" },
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "TenderOS",
        url: siteUrl,
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Tender, Bid & BOQ Management Software",
        operatingSystem: "Web (Cloud / SaaS)",
        inLanguage: ["en", "ar"],
        publisher: { "@id": `${siteUrl}/#organization` },
        description:
          "Extract requirements and compliance matrices from 100+ page Arabic/English RFPs and BOQs in 90 seconds, then price bids with a deterministic, float-safe engine that never hallucinates a number.",
        featureList: [
          "AI requirement extraction from scanned Arabic/English RFPs & BOQs",
          "Cross-page BOQ table stitching and structuring",
          "Deterministic, float-safe financial proposal pricing (zero AI math hallucination)",
          "Compliance matrix automation with gap analysis",
          "Tenant-isolated corporate knowledge brain (RAG over past proposals)",
          "ERP integration and awarded-tender webhooks",
        ],
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "14-day free trial, no credit card required.",
        },
      },
    ],
  };
}
