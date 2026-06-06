import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { syncSubscription, handleSubscriptionCancelled } from "@/lib/billing/sync";

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
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
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
