import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, hasRole } from "@/lib/auth";
import { isBillingEnabled, isBillableTier, type BillingCycle } from "@/lib/billing/stripe";
import { createCheckoutSession } from "@/lib/billing/checkout";

const Body = z.object({
  tier: z.string().refine(isBillableTier, "Invalid plan tier"),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout Session for the caller's organization and returns
 * the hosted-checkout URL. Only org owners/admins may purchase.
 */
export async function POST(req: Request) {
  if (!isBillingEnabled()) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 }
    );
  }

  const { org, member } = await getAuthContext();

  if (!hasRole(member.role, "ADMIN")) {
    return NextResponse.json(
      { error: "Only an organization owner or admin can manage billing." },
      { status: 403 }
    );
  }

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tier = parsed.tier;
  const cycle: BillingCycle = parsed.cycle;

  // Existing customers upgrading from the billing page pay immediately
  // (no new trial); the public funnel applies the trial instead.
  try {
    const url = await createCheckoutSession({ org, tier, cycle });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[billing] checkout session failed:", err);
    return NextResponse.json(
      { error: `The ${tier} (${cycle}) plan isn't available yet.` },
      { status: 400 }
    );
  }
}
