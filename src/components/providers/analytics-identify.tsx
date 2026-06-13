"use client";

import { useEffect } from "react";
import { isClientAnalyticsConfigured, posthog } from "@/lib/analytics/posthog-client";

/**
 * Binds the signed-in person + their org group on the client so feature flags
 * and session recordings attach correctly. Rendered from the (dashboard) layout
 * with SERVER-resolved values, so the `organization` group key here (our
 * internal org id) is identical to the one server-side track() uses — client and
 * server events for a workspace roll up together. No email/name (Phase Security).
 */
export function AnalyticsIdentify({
  userId,
  organizationId,
  organizationName,
  plan,
  role,
}: {
  userId: string;
  organizationId: string;
  organizationName: string;
  plan: string;
  role: string;
}) {
  useEffect(() => {
    if (!isClientAnalyticsConfigured() || !userId) return;
    posthog.identify(userId, { role });
    posthog.group("organization", organizationId, { name: organizationName, plan });
  }, [userId, organizationId, organizationName, plan, role]);

  return null;
}
