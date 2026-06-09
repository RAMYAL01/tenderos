import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/marketing/navbar";
import { PricingTable } from "@/components/marketing/pricing-table";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/cta-section";
import { Footer } from "@/components/marketing/footer";

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for TenderOS. Start a 14-day free trial on any plan — Starter, Professional, or Business — and scale as your bid volume grows.",
};

/**
 * Standalone pricing page. Pricing was moved off the landing page so it has a
 * dedicated, linkable URL (better for SEO, ads, and sales conversations).
 * Signed-in users go straight to the dashboard.
 */
export default async function PricingPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <>
      <Navbar />
      <main>
        {/* Page header */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(59,130,246,0.10), transparent)",
            }}
          />
          <div className="mx-auto max-w-3xl px-4 pt-20 text-center sm:px-6 sm:pt-28">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              Pricing
            </p>
            <h1 className="mt-3 text-balance text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
              Pricing that scales with your{" "}
              <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                bid volume
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Every plan includes a 14-day free trial — no credit card required to
              start. Cancel anytime.
            </p>
          </div>
        </section>

        <PricingTable />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
