import "server-only";
import { logger } from "@/lib/logger";
import { PLAN_LIMITS } from "@/lib/constants";
import { getPostHogServer } from "./posthog-server";
import type { AnalyticsContext, AnalyticsEvent, AnalyticsProps } from "./events";

/**
 * Server-side capture — the one public API for business events. Attaches the
 * org-first context (Phase 2) and the PostHog `organization` group to every
 * event, sanitizes properties to metadata-only, flushes (serverless-safe), and
 * NEVER throws (a tracking failure must not affect the business mutation). No-op
 * when PostHog is unconfigured.
 */

// Keys we refuse to send — defense in depth against accidental content/PII.
const BLOCKED_KEY = /email|password|token|secret|apikey|api_key|content|body|ssn|iban|creditcard|card_number/i;

/** Metadata-only: drop PII-ish keys, non-primitives, and over-long strings. */
function sanitize(props?: AnalyticsProps): AnalyticsProps {
  if (!props) return {};
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (BLOCKED_KEY.test(k)) continue;
    if (v === null || v === undefined) continue;
    const t = typeof v;
    if (t === "number" || t === "boolean") out[k] = v;
    else if (t === "string") out[k] = (v as string).slice(0, 200);
    // objects/arrays/functions are dropped — they could carry content
  }
  return out;
}

export async function track(
  event: AnalyticsEvent,
  ctx: AnalyticsContext,
  props?: AnalyticsProps
): Promise<void> {
  const ph = getPostHogServer();
  if (!ph) return;
  try {
    ph.capture({
      distinctId: ctx.userId,
      event,
      properties: {
        organizationId: ctx.organizationId,
        organizationName: ctx.organizationName,
        plan: ctx.plan,
        role: ctx.role,
        ...sanitize(props),
      },
      groups: { organization: ctx.organizationId },
    });
    await ph.flush();
  } catch (err) {
    logger.error({ err, event }, "analytics: track failed");
  }
}

/**
 * Build the org-first context from a getAuthContext() result. Server actions
 * already hold `{ clerkUserId, org, member }`, so wiring an event is one line:
 *   await track(EVENT, analyticsContext(auth), { ... })
 */
export function analyticsContext(auth: {
  clerkUserId: string;
  org: { id: string; name: string; planTier: keyof typeof PLAN_LIMITS };
  member: { role: string };
}): AnalyticsContext {
  return {
    userId: auth.clerkUserId,
    organizationId: auth.org.id,
    organizationName: auth.org.name,
    plan: PLAN_LIMITS[auth.org.planTier]?.label ?? String(auth.org.planTier),
    role: auth.member.role,
  };
}

/**
 * Context for API routes that have the Clerk userId + org row but not a Member
 * object. Role defaults to "member" — for these (mostly AI-usage) events the org
 * group + plan are the analytical dimensions that matter; pass `role` when known.
 */
export function apiContext(args: {
  userId: string;
  org: { id: string; name: string; planTier: keyof typeof PLAN_LIMITS };
  role?: string;
}): AnalyticsContext {
  return {
    userId: args.userId,
    organizationId: args.org.id,
    organizationName: args.org.name,
    plan: PLAN_LIMITS[args.org.planTier]?.label ?? String(args.org.planTier),
    role: args.role ?? "member",
  };
}

/** Context for server-side seams that only have an org (e.g. webhooks, crons). */
export function systemContext(org: {
  id: string;
  name: string;
  planTier: keyof typeof PLAN_LIMITS;
}): AnalyticsContext {
  return {
    userId: `org:${org.id}`, // system actor — no human triggered it
    organizationId: org.id,
    organizationName: org.name,
    plan: PLAN_LIMITS[org.planTier]?.label ?? String(org.planTier),
    role: "system",
  };
}
