/**
 * POST|GET /api/internal/webhooks/process
 *
 * Part 3 — the queue worker. Drains due webhook deliveries (PENDING +
 * nextAttemptAt <= now), POSTing each with retry/backoff. Intended to be driven
 * by Vercel Cron (every minute) or an external scheduler. Secured by a shared
 * secret so it can't be triggered by the public.
 *
 *   // vercel.json
 *   { "crons": [{ "path": "/api/internal/webhooks/process", "schedule": "* * * * *" }] }
 */

import { NextResponse } from "next/server";
import { processWebhookQueue } from "@/lib/integrations/webhooks";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? process.env.INTERNAL_API_KEY;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : undefined;
  return bearer === secret || req.headers.get("x-internal-secret") === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const result = await processWebhookQueue(50);
  return NextResponse.json(result);
}

export const POST = handle;
export const GET = handle; // Vercel Cron issues GET with the Authorization bearer
