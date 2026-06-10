/**
 * Next.js instrumentation — runs once when the server boots (node runtime).
 * Validates the environment up front so misconfiguration fails the deploy,
 * not a customer's request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
