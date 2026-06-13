import "server-only";
import { logger } from "@/lib/logger";
import { getPostHogServer } from "./posthog-server";

/**
 * Person identity (server-side). distinct_id is the stable Clerk/OIDC user id —
 * NEVER an email. Person properties are restricted to non-PII behavioural
 * attributes (role, locale). Email/name are deliberately NOT sent (Phase
 * "Security"); enable them in PostHog later only if you accept that tradeoff.
 *
 * Most identity binding happens client-side in the PostHog provider (so feature
 * flags + session recordings attach correctly); this server helper exists for
 * server-only flows and to set role on the person record.
 */
export async function identifyUser(
  userId: string,
  props?: { role?: string; locale?: string; plan?: string }
): Promise<void> {
  const ph = getPostHogServer();
  if (!ph) return;
  try {
    ph.identify({
      distinctId: userId,
      properties: {
        ...(props?.role ? { role: props.role } : {}),
        ...(props?.locale ? { locale: props.locale } : {}),
        ...(props?.plan ? { plan: props.plan } : {}),
      },
    });
    await ph.flush();
  } catch (err) {
    logger.error({ err }, "analytics: identify failed");
  }
}
