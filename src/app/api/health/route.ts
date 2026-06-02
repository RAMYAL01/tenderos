import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/health
 *
 * Health check endpoint for:
 * - Vercel deployment smoke tests
 * - Uptime monitoring (UptimeRobot, Betterstack, etc.)
 * - Load balancer health probes
 * - CI/CD post-deployment verification
 *
 * Returns 200 if all critical systems are up.
 * Returns 503 if any critical system is unreachable.
 *
 * This endpoint is public (no auth required) — see middleware.ts.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthCheck {
  status: "ok" | "degraded" | "down";
  checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }>;
  version: string;
  timestamp: string;
  environment: string;
}

export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  const result: HealthCheck = {
    status: "ok",
    checks: {},
    version: process.env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };

  // ── Database check ──────────────────────────────────────────────────────────
  const dbStart = Date.now();
  try {
    // Lightweight query — just check connectivity
    await db.$queryRaw`SELECT 1`;
    result.checks.database = {
      status: "ok",
      latencyMs: Date.now() - dbStart,
    };
  } catch (err) {
    result.checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: process.env.NODE_ENV === "development"
        ? (err instanceof Error ? err.message : String(err))
        : "Database connection failed",
    };
    result.status = "down";
  }

  // ── S3 check ────────────────────────────────────────────────────────────────
  const s3Start = Date.now();
  try {
    const { s3, S3_BUCKET } = await import("@/lib/s3");
    const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    result.checks.s3 = {
      status: "ok",
      latencyMs: Date.now() - s3Start,
    };
  } catch {
    // S3 failure is degraded, not down (read operations still work from DB)
    result.checks.s3 = {
      status: "error",
      latencyMs: Date.now() - s3Start,
      error: "S3 connectivity issue",
    };
    if (result.status === "ok") result.status = "degraded";
  }

  // ── Environment checks ──────────────────────────────────────────────────────
  const requiredEnvVars = [
    "DATABASE_URL",
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];

  const missingVars = requiredEnvVars.filter(
    (v) => !process.env[v]
  );

  result.checks.environment = missingVars.length === 0
    ? { status: "ok" }
    : {
        status: "error",
        error: `Missing env vars: ${missingVars.join(", ")}`,
      };

  if (missingVars.length > 0 && result.status === "ok") {
    result.status = "degraded";
  }

  // ── Response ────────────────────────────────────────────────────────────────
  const httpStatus = result.status === "down" ? 503 : 200;

  return NextResponse.json(
    {
      ...result,
      totalLatencyMs: Date.now() - startTime,
    },
    {
      status: httpStatus,
      headers: {
        // Don't cache health checks
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Health-Status": result.status,
      },
    }
  );
}
