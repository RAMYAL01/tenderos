import type { Organization } from "@prisma/client";
import { db } from "@/lib/prisma";
import {
  getStripe,
  getPriceId,
  type BillableTier,
  type BillingCycle,
} from "./stripe";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

/** Default free-trial length applied to self-serve Checkout sessions. */
export const TRIAL_DAYS = 14;

/**
 * Create (or reuse) a Stripe customer for an org and open a subscription
 * Checkout session. Shared by both the billing API route and the public
 * /checkout funnel so the customer-dedup + session config stay identical.
 *
 * Returns the hosted Checkout URL to redirect the buyer to.
 */
export async function createCheckoutSession(opts: {
  org: Organization;
  tier: BillableTier;
  cycle: BillingCycle;
  /** Add a free trial (no immediate charge). Defaults to 0 (charge now). */
  trialDays?: number;
}): Promise<string> {
  const { org, tier, cycle, trialDays = 0 } = opts;
  const priceId = getPriceId(tier, cycle);
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
    // Persist immediately so we never create duplicate customers on retry.
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
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
    metadata: { orgId: org.id, tier, cycle },
    success_url: `${SITE}/settings/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${SITE}/settings/billing?canceled=1`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL");
  }
  return session.url;
}
