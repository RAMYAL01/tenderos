import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay for debugging UI issues (5% of sessions in production)
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",

  // Filter out noise
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error exception captured",
    "Non-Error promise rejection captured",
    "AbortError",
    "NetworkError",
    "Failed to fetch",
    "Load failed",
  ],

  // Enrich events with user context
  beforeSend(event) {
    // Strip PII from breadcrumbs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breadcrumbValues = event.breadcrumbs?.values as any;
    if (breadcrumbValues && typeof breadcrumbValues === "object") {
      const valArray: any[] = Array.isArray(breadcrumbValues) ? breadcrumbValues : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event.breadcrumbs as any).values = valArray.map((b: any) => {
        if (b.data?.url) {
          // Remove query params that might contain tokens
          try {
            const url = new URL(b.data.url as string);
            url.searchParams.delete("token");
            url.searchParams.delete("key");
            b.data.url = url.toString();
          } catch {}
        }
        return b;
      });
    }
    return event;
  },

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,          // Mask proposal content (confidential)
      blockAllMedia: true,        // Don't record media
    }),
  ],
});
