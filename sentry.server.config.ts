import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance: sample 10% of traces in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production",

  // Tag all server-side events with the deployment environment
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",

  // Add release version for source map association
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  beforeSend(event, hint) {
    const error = hint?.originalException;

    // Don't send rate limit or auth errors to Sentry (too noisy)
    if (error instanceof Error) {
      if (
        error.message.includes("RATE_LIMIT") ||
        error.message.includes("Unauthorized") ||
        error.message.includes("Authentication")
      ) {
        return null;
      }
    }

    // Enrich with request context
    return event;
  },
});
