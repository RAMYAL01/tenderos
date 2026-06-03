import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { LogoMarquee } from "@/components/marketing/logo-marquee";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { StatsBand } from "@/components/marketing/stats-band";
import { Testimonials } from "@/components/marketing/testimonials";
import { PricingTable } from "@/components/marketing/pricing-table";
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
      <Navbar />
      <main>
        <Hero />
        <LogoMarquee />
        <Features />
        <HowItWorks />
        <StatsBand />
        <Testimonials />
        <PricingTable />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
