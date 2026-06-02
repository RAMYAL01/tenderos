/**
 * Next.js Instrumentation Hook
 *
 * This file is the entry point for:
 * - Sentry server-side initialization
 * - OpenTelemetry setup (future)
 * - Any server startup logic
 *
 * Runs once when the Next.js server starts.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
