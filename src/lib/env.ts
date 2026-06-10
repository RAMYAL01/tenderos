import { z } from "zod";

/**
 * Startup environment validation — fail loudly at boot, not at customer-request
 * time. Called from src/instrumentation.ts (Next.js server start).
 *
 * Hard requirements (throw in production): only what every deployment mode
 * needs. Provider-specific vars (Clerk vs OIDC, Stripe, AI) are validated
 * conditionally and reported as loud warnings, because the enterprise/airgapped
 * edition intentionally runs without the cloud ones.
 */

const CoreSchema = z.object({
  DATABASE_URL: z.string().min(10, "DATABASE_URL is required"),
});

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const problems: string[] = [];
  const warnings: string[] = [];

  // Core — required everywhere.
  const core = CoreSchema.safeParse(process.env);
  if (!core.success) {
    problems.push(...core.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  }

  const isOidc = process.env.AUTH_PROVIDER === "oidc";
  if (isOidc) {
    for (const k of ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_SESSION_SECRET"]) {
      if (!process.env[k]) problems.push(`${k} is required when AUTH_PROVIDER=oidc`);
    }
  } else {
    for (const k of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
      if (!process.env[k]) problems.push(`${k} is required for Clerk auth`);
    }
  }

  // AI providers — warn (local-LLM mode replaces Anthropic; Ollama replaces OpenAI).
  if (process.env.LLM_PROVIDER !== "local" && !process.env.ANTHROPIC_API_KEY) {
    warnings.push("ANTHROPIC_API_KEY is missing — AI features will fail (set LLM_PROVIDER=local for on-prem).");
  }
  if (process.env.EMBEDDING_PROVIDER !== "ollama" && !process.env.OPENAI_API_KEY) {
    warnings.push("OPENAI_API_KEY is missing — embeddings/RAG will fail (set EMBEDDING_PROVIDER=ollama for on-prem).");
  }

  // Billing — warn (enterprise mode has no Stripe).
  if (!isOidc) {
    if (!process.env.STRIPE_SECRET_KEY) warnings.push("STRIPE_SECRET_KEY is missing — checkout/portal will fail.");
    if (!process.env.STRIPE_WEBHOOK_SECRET) warnings.push("STRIPE_WEBHOOK_SECRET is missing — billing webhooks will be rejected.");
  }

  for (const w of warnings) console.warn(`[env] WARNING: ${w}`);

  if (problems.length > 0) {
    const msg = `[env] Invalid environment:\n  - ${problems.join("\n  - ")}`;
    if (isProd) throw new Error(msg);
    console.error(msg); // dev: loud, but don't block local hacking
  }
}
