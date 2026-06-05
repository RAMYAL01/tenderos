/**
 * Part 3 — The Webhook Emitter (push data OUT to client ERPs).
 *
 * emit*() records durable, PENDING deliveries (a fast DB write — the request is
 * never blocked on the client's ERP). A queue processor (cron / background job)
 * then POSTs each as signed JSON with bounded timeouts and EXPONENTIAL BACKOFF.
 * A delivery is only lost after it exhausts maxAttempts, at which point it is
 * dead-lettered (status FAILED) — never silently dropped.
 *
 * Security: each payload is HMAC-SHA256 signed with the endpoint's secret over
 * `${timestamp}.${body}` so the receiver can verify authenticity + reject
 * replays. The stable delivery id is the receiver's idempotency key.
 */

import crypto from "node:crypto";
import { db } from "@/lib/prisma";
import { WebhookDeliveryStatus } from "@prisma/client";
import type { WebhookEnvelope, WebhookEventType, WebhookPayloadMap } from "./types";

const REQUEST_TIMEOUT_MS = 10_000;
const BASE_BACKOFF_MS = 30_000; // 30s, then 1m, 2m, 4m, ...
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000; // cap at 6h

// ── Emit ──────────────────────────────────────────────────────────────────────

/** Create durable deliveries for an event to every subscribed, active endpoint. */
export async function emitEvent<E extends WebhookEventType>(
  orgId: string,
  event: E,
  data: WebhookPayloadMap[E]
): Promise<string[]> {
  const endpoints = await db.webhookEndpoint.findMany({
    where: { orgId, active: true, events: { has: event } },
    select: { id: true },
  });
  if (endpoints.length === 0) return [];

  const created = await db.$transaction(
    endpoints.map((e) =>
      db.webhookDelivery.create({
        data: {
          orgId,
          endpointId: e.id,
          eventType: event,
          payload: data as unknown as object,
          status: WebhookDeliveryStatus.PENDING,
          nextAttemptAt: new Date(),
        },
        select: { id: true },
      })
    )
  );
  return created.map((d) => d.id);
}

export const emitTenderWon = (orgId: string, data: WebhookPayloadMap["tender.won"]) =>
  emitEvent(orgId, "tender.won", data);

export const emitFinancialProposalFinalized = (
  orgId: string,
  data: WebhookPayloadMap["financial_proposal.finalized"]
) => emitEvent(orgId, "financial_proposal.finalized", data);

// ── Dispatch a single delivery (with retry scheduling) ────────────────────────

export async function dispatchDelivery(deliveryId: string): Promise<"delivered" | "retry" | "failed" | "skip"> {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: { select: { url: true, secret: true, active: true } } },
  });
  if (!delivery || delivery.status !== WebhookDeliveryStatus.PENDING || !delivery.endpoint?.active) {
    return "skip";
  }

  const envelope: WebhookEnvelope<unknown> = {
    id: delivery.id,
    event: delivery.eventType as WebhookEventType,
    created_at: delivery.createdAt.toISOString(),
    tenant_id: delivery.orgId,
    data: delivery.payload,
  };
  const body = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(delivery.endpoint.secret, `${timestamp}.${body}`);

  try {
    const res = await fetchWithTimeout(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TenderOS-Event": envelope.event,
        "X-TenderOS-Delivery": delivery.id,
        "X-TenderOS-Timestamp": timestamp,
        "X-TenderOS-Signature": `sha256=${signature}`,
      },
      body,
    });

    if (res.ok) {
      await db.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: WebhookDeliveryStatus.DELIVERED,
          attempts: delivery.attempts + 1,
          responseStatus: res.status,
          deliveredAt: new Date(),
          lastError: null,
        },
      });
      return "delivered";
    }
    return await scheduleRetry(delivery.id, delivery.attempts, delivery.maxAttempts, `HTTP ${res.status}`, res.status);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return scheduleRetry(delivery.id, delivery.attempts, delivery.maxAttempts, message, null);
  }
}

async function scheduleRetry(
  id: string,
  attempts: number,
  maxAttempts: number,
  error: string,
  responseStatus: number | null
): Promise<"retry" | "failed"> {
  const nextAttempts = attempts + 1;
  const exhausted = nextAttempts >= maxAttempts;
  await db.webhookDelivery.update({
    where: { id },
    data: {
      attempts: nextAttempts,
      status: exhausted ? WebhookDeliveryStatus.FAILED : WebhookDeliveryStatus.PENDING,
      nextAttemptAt: exhausted ? new Date() : new Date(Date.now() + backoffMs(nextAttempts)),
      lastError: error.slice(0, 500),
      responseStatus,
    },
  });
  return exhausted ? "failed" : "retry";
}

// ── Queue processor (cron / background job simulator) ─────────────────────────

export async function processWebhookQueue(limit = 50): Promise<{ processed: number; delivered: number; failed: number; retried: number }> {
  // Claim due deliveries atomically so concurrent workers don't double-send.
  const claimed = await db.$queryRaw<Array<{ id: string }>>`
    UPDATE webhook_deliveries
    SET "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM webhook_deliveries
      WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `;

  let delivered = 0;
  let failed = 0;
  let retried = 0;
  for (const { id } of claimed) {
    const outcome = await dispatchDelivery(id);
    if (outcome === "delivered") delivered++;
    else if (outcome === "failed") failed++;
    else if (outcome === "retry") retried++;
  }
  return { processed: claimed.length, delivered, failed, retried };
}

// ── primitives ─────────────────────────────────────────────────────────────────

function sign(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function backoffMs(attempt: number): number {
  const exp = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 5000);
  return Math.min(exp + jitter, MAX_BACKOFF_MS);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
