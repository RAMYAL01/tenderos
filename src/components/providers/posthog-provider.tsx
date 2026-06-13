"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initPostHogClient, isClientAnalyticsConfigured, posthog } from "@/lib/analytics/posthog-client";

/**
 * Boots PostHog on the client and captures App-Router pageviews on route change.
 * Also closes the email→product loop: a visit carrying `?ref=digest` (from the
 * daily digest CTA) fires `digest_engaged` — no tracking pixel, privacy-friendly.
 * Renders children untouched; a complete no-op when the key is absent.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Init once + one-shot digest-engagement capture from the landing URL.
  useEffect(() => {
    initPostHogClient();
    if (!isClientAnalyticsConfigured()) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("ref") === "digest") posthog.capture("digest_engaged", { action: "clicked" });
  }, []);

  // Pageview on every route change (and on first mount).
  useEffect(() => {
    if (!isClientAnalyticsConfigured()) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [pathname]);

  return <>{children}</>;
}
