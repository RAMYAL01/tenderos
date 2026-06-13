import type Stripe from "stripe";
import { after } from "next/server";
import { db } from "@/lib/prisma";
import { getStripe } from "@/lib/billing/stripe";
import { syncSubscription, handleSubscriptionCancelled, resolveOrgId } from "@/lib/billing/sync";
import { notifyPaymentFailed, notifySubscriptionChange } from "@/lib/email/events";
import { track, systemContext } from "@/lib/analytics/track";
import { identifyOrganization } from "@/lib/analytics/groups";
import { ANALYTICS_EVENTS, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/events";

/** Format a Stripe minor-unit amount as a display string, e.g. "USD 499.00". */
function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (amount == null) return null;
  return `${(currency ?? "usd").toUpperCase()} ${(amount / 100).toFixed(2)}`;
}

/** Load the org and emit a revenue event against its group (no human actor). */
async function trackRevenue(orgId: string, event: AnalyticsEvent, props?: AnalyticsProps): Promise<void> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, planTier: true, countryCode: true, industry: true, organizationType: true, employeeCount: true },
  });
  if (!org) return;
  await identifyOrganization(org); // keep plan/properties fresh on the group
  await track(event, systemContext(org), props);
}

/**
 * Stripe Webhook Handler
 *
 * Keeps our Subscription rows + Organization plan limits in sync with Stripe.
 * Every event is verified against STRIPE_WEBHOOK_SECRET before processing.
 *
 * Events handled:
 * - checkout.session.completed            → first activation after purchase
 * - customer.subscription.created/updated → plan/period/status changes
 * - customer.subscription.deleted         → cancellation → revert to Starter
 * - invoice.payment_failed                → mark past_due
 *
 * Setup in Stripe Dashboard → Developers → Webhooks:
 *   URL:    https://www.thetenderos.com/api/webhooks/stripe
 *   Events: the five above
 *   Copy the signing secret → STRIPE_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = getStripe();
  const body = await req.text(); // raw body required for signature verification

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          // Carry the orgId from the session onto the subscription metadata
          // path resolver in case subscription_data.metadata didn't propagate.
          if (!sub.metadata?.orgId && session.metadata?.orgId) {
            sub.metadata = { ...sub.metadata, orgId: session.metadata.orgId };
          }
          await syncSubscription(sub);

          // Activation email — trial-started vs upgraded, to org admins.
          const orgId = await resolveOrgId(sub);
          if (orgId) {
            const trialing = sub.status === "trialing";
            after(() =>
              notifySubscriptionChange({
                orgId,
                kind: trialing ? "TRIAL_STARTED" : "UPGRADED",
                trialEndsOn: sub.trial_end
                  ? new Date(sub.trial_end * 1000).toISOString().slice(0, 10)
                  : null,
              })
            );
            after(() =>
              trackRevenue(
                orgId,
                trialing ? ANALYTICS_EVENTS.TRIAL_STARTED : ANALYTICS_EVENTS.SUBSCRIPTION_CHANGED,
                trialing ? {} : { kind: "upgraded" }
              )
            );
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(sub);
        const orgId = await resolveOrgId(sub);
        if (orgId) {
          after(() => notifySubscriptionChange({ orgId, kind: "CANCELLED" }));
          after(() => trackRevenue(orgId, ANALYTICS_EVENTS.SUBSCRIPTION_CHANGED, { kind: "cancelled" }));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = (invoice as unknown as { subscription?: string | { id: string } })
          .subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub); // status will be past_due / unpaid
          const orgId = await resolveOrgId(sub);
          if (orgId) {
            const amountDue = formatAmount(invoice.amount_due, invoice.currency);
            after(() => notifyPaymentFailed({ orgId, amountDue }));
            after(() => trackRevenue(orgId, ANALYTICS_EVENTS.PAYMENT_FAILED));
          }

        }
        break;
      }

      default:
        // Unhandled event — ack so Stripe doesn't retry.
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`Error processing Stripe event ${event.type}:`, err);
    return new Response("Internal server error", { status: 500 });
  }
}
