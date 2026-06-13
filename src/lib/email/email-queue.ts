import "server-only";
import * as React from "react";
import type { EmailCategory, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  RESEND_BATCH_MAX,
  getResend,
  isDryRun,
  isEmailConfigured,
} from "./resend";
import { renderEmail } from "./send-email";
import type { NotificationEvent } from "./types";

import DailyDigestEmail from "./templates/daily-digest";

/**
 * Outbox queue for HIGH-VOLUME fan-out (the daily digest). Low-volume
 * transactional mail sends immediately via send-email.ts; bulk mail is enqueued
 * here as EmailLog rows (status QUEUED) and drained in rate-limited batches with
 * Resend's batch endpoint. The EmailLog table IS the queue — at very high scale
 * you swap the drain trigger (cron → QStash/SQS worker) without schema change.
 *
 * Re-render contract: an enqueued row stores its full template payload in
 * EmailLog.payload; the drainer reconstructs the element from (event, payload)
 * via TEMPLATE_REGISTRY. Keep payloads free of secrets.
 */

// event → template component (only queued events need an entry).
const TEMPLATE_REGISTRY: Partial<
  Record<NotificationEvent, (props: Record<string, unknown>) => React.ReactElement>
> = {
  NEW_DISCOVERY_MATCH: (props) => React.createElement(DailyDigestEmail, props as never),
};

export interface EnqueueInput {
  orgId: string;
  memberId?: string | null;
  to: string;
  event: NotificationEvent;
  category: EmailCategory;
  subject: string;
  /** Full template props — the drainer re-renders from this. No secrets. */
  payload: Prisma.InputJsonValue;
}

/** Append a message to the outbox (QUEUED). Cheap; the cron drains later. */
export async function enqueueEmail(input: EnqueueInput): Promise<void> {
  if (!isEmailConfigured()) return; // nothing will drain it — don't accumulate noise
  await db.emailLog
    .create({
      data: {
        orgId: input.orgId,
        memberId: input.memberId ?? null,
        toEmail: input.to.trim().toLowerCase(),
        category: input.category,
        event: input.event,
        subject: input.subject,
        status: "QUEUED",
        payload: input.payload,
      },
    })
    .catch((e) => logger.error({ err: e, event: input.event }, "enqueueEmail failed"));
}

export interface DrainResult {
  claimed: number;
  sent: number;
  failed: number;
}

/**
 * Drain up to `limit` queued emails in batches of RESEND_BATCH_MAX. Bounded for
 * Vercel's cron budget; call repeatedly to clear a backlog. Idempotent-ish: rows
 * are claimed (QUEUED→SENDING) before send so a re-run won't double-send the
 * same row. (For multi-worker scale, upgrade the claim to SELECT … FOR UPDATE
 * SKIP LOCKED — see docs/email-infrastructure.md.)
 */
export async function drainEmailQueue(limit = 200): Promise<DrainResult> {
  const result: DrainResult = { claimed: 0, sent: 0, failed: 0 };
  if (!isEmailConfigured()) return result;

  // Claim oldest-queued rows.
  const candidates = await db.emailLog.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  if (candidates.length === 0) return result;

  const ids = candidates.map((c) => c.id);
  const claim = await db.emailLog.updateMany({
    where: { id: { in: ids }, status: "QUEUED" },
    data: { status: "SENDING" },
  });
  result.claimed = claim.count;

  const rows = await db.emailLog.findMany({
    where: { id: { in: ids }, status: "SENDING" },
    select: { id: true, toEmail: true, subject: true, event: true, payload: true },
  });

  // Process in Resend-batch-sized chunks.
  for (let i = 0; i < rows.length; i += RESEND_BATCH_MAX) {
    const chunk = rows.slice(i, i + RESEND_BATCH_MAX);

    // Render each row from its stored payload.
    const rendered = await Promise.all(
      chunk.map(async (row) => {
        const factory = TEMPLATE_REGISTRY[row.event as NotificationEvent];
        if (!factory) return { row, entry: null as null | Record<string, unknown> };
        try {
          const el = factory((row.payload as Record<string, unknown>) ?? {});
          const { html, text } = await renderEmail(el);
          return {
            row,
            entry: { from: EMAIL_FROM, to: row.toEmail, subject: row.subject, html, text, replyTo: EMAIL_REPLY_TO },
          };
        } catch (e) {
          logger.error({ err: e, id: row.id, event: row.event }, "queue: render failed");
          return { row, entry: null };
        }
      })
    );

    const sendable = rendered.filter((r) => r.entry !== null);
    const unrenderable = rendered.filter((r) => r.entry === null);

    // Rows we couldn't render → FAILED.
    for (const u of unrenderable) {
      await markRow(u.row.id, "FAILED", "render_failed");
      result.failed++;
    }
    if (sendable.length === 0) continue;

    if (isDryRun()) {
      for (const s of sendable) {
        await markRow(s.row.id, "SENT", null, "dry-run");
        result.sent++;
      }
      continue;
    }

    try {
      const resend = getResend();
      const { data, error } = await resend.batch.send(
        sendable.map((s) => s.entry as NonNullable<typeof s.entry>) as never
      );
      if (error) {
        for (const s of sendable) {
          await markRow(s.row.id, "FAILED", (error as { message?: string }).message ?? "batch_error");
          result.failed++;
        }
        logger.error({ err: error, count: sendable.length }, "queue: batch send failed");
        continue;
      }
      // Map provider ids back by index when present.
      const sentIds = (data as unknown as { data?: { id: string }[] } | { id: string }[] | null);
      const idList = Array.isArray(sentIds) ? sentIds : sentIds?.data ?? [];
      for (let j = 0; j < sendable.length; j++) {
        await markRow(sendable[j].row.id, "SENT", null, idList[j]?.id ?? null);
        result.sent++;
      }
    } catch (e) {
      for (const s of sendable) {
        await markRow(s.row.id, "FAILED", e instanceof Error ? e.message : "exception");
        result.failed++;
      }
      logger.error({ err: e }, "queue: batch send threw");
    }
  }

  logger.info(result, "email queue drained");
  return result;
}

async function markRow(
  id: string,
  status: "SENT" | "FAILED",
  error: string | null,
  providerId?: string | null
): Promise<void> {
  await db.emailLog
    .update({
      where: { id },
      data: {
        status,
        error: error ? error.slice(0, 1000) : null,
        providerMessageId: providerId ?? undefined,
        sentAt: status === "SENT" ? new Date() : undefined,
      },
    })
    .catch(() => {});
}
