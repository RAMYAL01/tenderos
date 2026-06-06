import { NextResponse } from "next/server";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { getStripe, isBillingEnabled } from "@/lib/billing/stripe";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

/**
 * POST /api/billing/portal
 * Opens the Stripe Customer Portal so a customer can upgrade, downgrade,
 * update their card, download invoices, or cancel. Owners/admins only.
 */
export async function POST() {
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

  const sub = await db.subscription.findUnique({
    where: { orgId: org.id },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account yet. Choose a plan to get started." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${SITE}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
