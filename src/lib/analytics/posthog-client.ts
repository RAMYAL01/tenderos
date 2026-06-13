import posthog from "posthog-js";

/**
 * Client-side PostHog (posthog-js). Handles pageviews, session recordings,
 * feature flags, and identity binding — NOT business events (those fire
 * server-side in track.ts, so they can't be blocked or carry stray content).
 *
 * SECURITY posture (Phase "Security"):
 *  - autocapture OFF      → we never auto-capture clicks/inputs, so tender,
 *                           proposal, and BOQ field values can't leak.
 *  - mask all inputs+text → session recordings show layout/flow, never content.
 *  - person_profiles identified_only → no anonymous shadow profiles.
 * No-op when NEXT_PUBLIC_POSTHOG_KEY is unset.
 */

let initialized = false;

export function isClientAnalyticsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function initPostHogClient(): void {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  initialized = true;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false, // captured manually on route change (App Router)
    capture_pageleave: true,
    autocapture: false, // SECURITY: no auto-capture of inputs/clicks → no content/PII
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true, // SECURITY: every input value masked
      maskTextSelector: "*", // SECURITY: mask all text (tender/proposal content)
    },
  });
}

export { posthog };
