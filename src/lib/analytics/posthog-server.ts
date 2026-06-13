import "server-only";
import { PostHog } from "posthog-node";

/**
 * Server-side PostHog client (posthog-node). Lazily constructed so a missing key
 * is a clean no-op — analytics is OPTIONAL, never a hard dependency (same
 * contract as the email/S3/AI clients). This is the PRIMARY tracking path:
 * business events fire here, server-side, so payloads are curated and immune to
 * ad-blockers.
 *
 * Serverless note: flushAt:1 + flushInterval:0 send each event promptly; track.ts
 * awaits flush() so events aren't lost when the lambda freezes.
 */

let client: PostHog | null = null;
let resolved = false;

function serverKey(): string | undefined {
  return process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(serverKey());
}

export function getPostHogServer(): PostHog | null {
  if (resolved) return client;
  resolved = true;
  const key = serverKey();
  if (!key) return (client = null);
  client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}
