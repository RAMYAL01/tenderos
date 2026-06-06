import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthContext, hasRole } from "@/lib/auth";
import { isBillingEnabled, isBillableTier, type BillingCycle } from "@/lib/billing/stripe";
import { createCheckoutSession, TRIAL_DAYS } from "@/lib/billing/checkout";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const dynamic = "force-dynamic";

/**
 * Public checkout funnel.
 *
 * Pricing CTAs link here with ?tier=&cycle=. We gate on auth while preserving
 * the chosen plan, then redirect straight to Stripe Checkout (with a free
 * trial). New visitors flow: pricing → sign-up → org → Stripe Checkout.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cycle?: string }>;
}) {
  const { tier: rawTier, cycle: rawCycle } = await searchParams;

  // Validate the requested plan; bad/empty params → back to pricing.
  const tier = (rawTier ?? "").toUpperCase();
  if (!isBillableTier(tier)) {
    redirect("/#pricing");
  }
  const cycle: BillingCycle = rawCycle === "annual" ? "annual" : "monthly";
  const dest = `/checkout?tier=${tier}&cycle=${cycle}`;

  // If billing isn't configured yet, fall back to the trial sign-up.
  if (!isBillingEnabled()) {
    redirect("/sign-up");
  }

  // Auth gate — preserve the plan choice across sign-up / org selection.
  const { userId, orgId } = await auth();
  if (!userId) {
    redirect(`/sign-up?redirect_url=${encodeURIComponent(dest)}`);
  }
  if (!orgId) {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(dest)}`);
  }

  const { org, member } = await getAuthContext();

  // Only owners/admins can start a paid plan; others manage from settings.
  if (!hasRole(member.role, "ADMIN")) {
    redirect("/settings/billing");
  }

  // Create the Checkout session, then redirect to Stripe (outside try/catch so
  // the NEXT_REDIRECT control-flow isn't swallowed).
  let url: string | null = null;
  try {
    url = await createCheckoutSession({ org, tier, cycle, trialDays: TRIAL_DAYS });
  } catch (err) {
    console.error("[checkout] could not create session:", err);
  }
  if (url) {
    redirect(url);
  }

  // Fallback UI if the plan/price isn't configured in Stripe yet.
  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          This plan isn&apos;t available yet
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          We couldn&apos;t start checkout for the {tier.toLowerCase()} plan. This usually
          means the price isn&apos;t configured. Please try another plan or contact us.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/#pricing"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Back to pricing
          </Link>
          <a
            href="mailto:support@thetenderos.com"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Contact support
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
