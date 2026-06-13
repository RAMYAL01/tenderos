"use client";

import { useEffect, useRef } from "react";
import { isClientAnalyticsConfigured, posthog } from "@/lib/analytics/posthog-client";
import type { AnalyticsEvent, AnalyticsProps } from "@/lib/analytics/events";

/**
 * Fires a client-side analytics event exactly once when mounted. For view-style
 * events that have no server seam (e.g. discovery_viewed). The org group is
 * already bound by AnalyticsIdentify, so this rolls up under the workspace.
 * No-op without a key.
 */
export function CaptureEvent({ event, props }: { event: AnalyticsEvent; props?: AnalyticsProps }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current || !isClientAnalyticsConfigured()) return;
    fired.current = true;
    posthog.capture(event, props);
  }, [event, props]);
  return null;
}
