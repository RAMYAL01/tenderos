import Stripe from "stripe";
import type { PlanTier } from "@prisma/client";

/**
 * Stripe client singleton.
 *
 * apiVersion is intentionally omitted — the installed SDK pins its own default
 * API version, which avoids a TS version-string mismatch on upgrades.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  _stripe = new Stripe(key);
  return _stripe;
}

/** Whether billing is configured (used to gracefully hide UI when keys absent). */
export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export type BillingCycle = "monthly" | "annual";

/** Tiers that are self-serve purchasable (ENTERPRISE is contact-sales only). */
export const BILLABLE_TIERS = ["STARTER", "PROFESSIONAL", "BUSINESS"] as const;
export type BillableTier = (typeof BILLABLE_TIERS)[number];

export function isBillableTier(t: string): t is BillableTier {
  return (BILLABLE_TIERS as readonly string[]).includes(t);
}

/**
 * Price IDs come from the Stripe dashboard via env vars. One price per
 * (tier × billing cycle). Create these as recurring Prices on Products
 * matching the Starter/Professional/Business plans.
 */
const PRICE_ENV: Record<BillableTier, Record<BillingCycle, string | undefined>> = {
  STARTER: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    annual: process.env.STRIPE_PRICE_STARTER_ANNUAL,
  },
  PROFESSIONAL: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    annual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL,
  },
  BUSINESS: {
    monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
    annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
  },
};

/** Resolve a Stripe price ID for a tier + cycle. Throws if not configured. */
export function getPriceId(tier: BillableTier, cycle: BillingCycle): string {
  const id = PRICE_ENV[tier]?.[cycle];
  if (!id) {
    throw new Error(`No Stripe price configured for ${tier} / ${cycle}`);
  }
  return id;
}

/** Reverse lookup: map a Stripe price ID back to a plan tier + cycle. */
export function priceIdToPlan(
  priceId: string | null | undefined
): { tier: BillableTier; cycle: BillingCycle } | null {
  if (!priceId) return null;
  for (const tier of BILLABLE_TIERS) {
    for (const cycle of ["monthly", "annual"] as const) {
      if (PRICE_ENV[tier][cycle] === priceId) return { tier, cycle };
    }
  }
  return null;
}

/** Map a Stripe subscription status to our internal status string. */
export function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "unpaid":
      return "unpaid";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
    default:
      return "past_due";
  }
}

/**
 * Read the current period end from a Subscription. In recent Stripe API
 * versions this lives on the subscription item, not the top level — read
 * defensively so we work across versions.
 */
export function subscriptionPeriod(sub: Stripe.Subscription): {
  start: Date;
  end: Date;
} {
  const item = sub.items?.data?.[0] as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  } | undefined;
  const legacy = sub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const startTs = item?.current_period_start ?? legacy.current_period_start;
  const endTs = item?.current_period_end ?? legacy.current_period_end;
  const now = Date.now();
  return {
    start: startTs ? new Date(startTs * 1000) : new Date(now),
    end: endTs ? new Date(endTs * 1000) : new Date(now + 30 * 24 * 60 * 60 * 1000),
  };
}

/** Pull the active price ID off a subscription. */
export function subscriptionPriceId(sub: Stripe.Subscription): string | null {
  return sub.items?.data?.[0]?.price?.id ?? null;
}

export type { PlanTier };
