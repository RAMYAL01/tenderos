import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import {
  getStripe,
  getPriceId,
  isBillingEnabled,
  isBillableTier,
  type BillingCycle,
} from "@/lib/billing/stripe";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

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

  let priceId: string;
  try {
    priceId = getPriceId(tier, cycle);
  } catch {
    return NextResponse.json(
      { error: `The ${tier} (${cycle}) plan is not available yet.` },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  // Reuse an existing Stripe customer for this org if we have one.
  const existing = await db.subscription.findUnique({
    where: { orgId: org.id },
    select: { stripeCustomerId: true },
  });

  let customerId = existing?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      metadata: { orgId: org.id, clerkOrgId: org.clerkOrgId },
    });
    customerId = customer.id;
    // Persist immediately so we never create duplicate customers.
    await db.subscription.upsert({
      where: { orgId: org.id },
      create: {
        orgId: org.id,
        planTier: org.planTier,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        stripeCustomerId: customerId,
        status: "incomplete",
      },
      update: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: org.id,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: { orgId: org.id, clerkOrgId: org.clerkOrgId },
    },
    metadata: { orgId: org.id, tier, cycle },
    success_url: `${SITE}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/settings/billing?canceled=1`,
  });

  return NextResponse.json({ url: session.url });
}
