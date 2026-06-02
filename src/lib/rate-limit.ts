/**
 * Rate Limiting for TenderOS API Routes
 *
 * Two-tier implementation:
 *
 * TIER 1 (MVP / Vercel Hobby):
 *   In-memory LRU cache. Works on a single instance.
 *   ⚠️ Not suitable for production with multiple Vercel instances.
 *
 * TIER 2 (Production / Vercel Pro):
 *   Upstash Redis. Globally consistent across all instances.
 *   Uncomment the Upstash section when ready to upgrade.
 *   Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local
 *
 * Usage:
 *   const result = await rateLimit(request, { limit: 10, window: "1m" });
 *   if (!result.success) return tooManyRequests(result.resetIn);
 */

import { NextResponse } from "next/server";

// Note: pino (logger.ts) is a Node.js module — cannot be imported in Edge runtime
// (middleware). Use console instead for rate-limit events.
function logRateLimitExceeded(identifier: string, limit: number, window: string) {
  console.warn(JSON.stringify({ event: "rate_limit.exceeded", identifier, limit, window }));
}

interface RateLimitOptions {
  limit: number;           // Max requests per window
  window: "10s" | "1m" | "5m" | "1h";
  identifier?: string;     // Override the default IP-based identifier
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetIn: number;  // Seconds until window resets
}

// ── In-memory store (Tier 1) ───────────────────────────────────────────────────

const WINDOW_MS: Record<RateLimitOptions["window"], number> = {
  "10s": 10_000,
  "1m":  60_000,
  "5m":  300_000,
  "1h":  3_600_000,
};

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Simple Map-based store — bounded to prevent memory leaks
const store = new Map<string, WindowEntry>();
const MAX_STORE_SIZE = 10_000;

function getEntry(key: string, windowMs: number): WindowEntry {
  const now = Date.now();
  const existing = store.get(key);

  if (existing && existing.resetAt > now) {
    return existing;
  }

  // Evict if store is too large
  if (store.size >= MAX_STORE_SIZE) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }

  const entry: WindowEntry = { count: 0, resetAt: now + windowMs };
  store.set(key, entry);
  return entry;
}

// ── Rate limit check ───────────────────────────────────────────────────────────

export async function rateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const windowMs = WINDOW_MS[options.window];

  // Build identifier: IP + path
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("cf-connecting-ip") ??
    "unknown";

  const url = new URL(request.url);
  const identifier =
    options.identifier ?? `${ip}:${url.pathname}`;

  // ── Upstash Redis (Tier 2 — uncomment when ready) ──────────────────────────
  // import { Ratelimit } from "@upstash/ratelimit";
  // import { Redis } from "@upstash/redis";
  // const ratelimit = new Ratelimit({
  //   redis: Redis.fromEnv(),
  //   limiter: Ratelimit.slidingWindow(options.limit, options.window),
  //   analytics: true,
  // });
  // const { success, limit, remaining, reset } = await ratelimit.limit(identifier);
  // return { success, limit, remaining, resetIn: Math.ceil((reset - Date.now()) / 1000) };
  // ──────────────────────────────────────────────────────────────────────────────

  // Tier 1: In-memory
  const entry = getEntry(identifier, windowMs);
  entry.count++;

  const remaining = Math.max(0, options.limit - entry.count);
  const resetIn = Math.ceil((entry.resetAt - Date.now()) / 1000);
  const success = entry.count <= options.limit;

  if (!success) {
    logRateLimitExceeded(identifier, options.limit, options.window);
  }

  return { success, limit: options.limit, remaining, resetIn };
}

/**
 * Predefined rate limit profiles for different endpoint types.
 */
export const RATE_LIMITS = {
  // Auth endpoints — strict
  auth: { limit: 10, window: "1m" } as RateLimitOptions,

  // AI endpoints — expensive, moderate limits
  aiGeneration: { limit: 20, window: "1m" } as RateLimitOptions,

  // Document upload — prevent spam
  upload: { limit: 30, window: "5m" } as RateLimitOptions,

  // General API — generous
  api: { limit: 100, window: "1m" } as RateLimitOptions,

  // Export — resource-intensive
  export: { limit: 10, window: "5m" } as RateLimitOptions,

  // Webhook endpoints — unlimited (verified by signature)
  webhook: { limit: 1000, window: "1m" } as RateLimitOptions,
} as const;

/**
 * Return a 429 Too Many Requests response with Retry-After header.
 */
export function tooManyRequests(resetIn: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please slow down.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: resetIn,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetIn),
        "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + resetIn),
      },
    }
  );
}

/**
 * Helper to add rate limit headers to any response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(result.limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + result.resetIn));
  return response;
}
