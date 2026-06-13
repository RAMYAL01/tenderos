import "server-only";
import * as React from "react";
import { render } from "@react-email/render";
import type { EmailCategory, Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  EMAIL_FROM,
  EMAIL_REPLY_TO,
  getResend,
  isDryRun,
  isEmailConfigured,
} from "./resend";
import type { NotificationEvent } from "./types";

/**
 * Low-level send: render → log → deliver, with retry, rate-limit backoff, and a
 * hard fail-safe (this NEVER throws — a mail failure must not break the business
 * mutation or the cron that triggered it). Every attempt is recorded in
 * EmailLog, which doubles as the admin activity view and the delivery audit.
 */

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

export interface SendInput {
  orgId: string;
  memberId?: string | null;
  to: string;
  event: NotificationEvent;
  category: EmailCategory;
  subject: string;
  /** A constructed template element, e.g. <InvitationEmail {...payload} />. */
  react: React.ReactElement;
  /** Render context snapshot stored on the log (must contain no secrets). */
  payload?: Prisma.InputJsonValue;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Render a template to both HTML and plain-text (deliverability + a11y). */
export async function renderEmail(
  react: React.ReactElement
): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ]);
  return { html, text };
}

/** Is this a transient error worth retrying (rate limit / 5xx / network)? */
function isRetryable(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? "";
  const status = (err as { statusCode?: number } | null)?.statusCode ?? 0;
  return (
    name === "rate_limit_exceeded" ||
    name === "application_error" ||
    status === 429 ||
    status >= 500
  );
}

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const to = input.to.trim().toLowerCase();

  // Unconfigured → no-op (don't fill EmailLog with noise in dev/CI/preview).
  if (!isEmailConfigured()) {
    logger.debug({ event: input.event, to }, "email skipped: RESEND_API_KEY not set");
    return { ok: false, skipped: true };
  }

  // Outbox row first — the row IS the audit trail even if delivery fails.
  let logId: string | null = null;
  try {
    const row = await db.emailLog.create({
      data: {
        orgId: input.orgId,
        memberId: input.memberId ?? null,
        toEmail: to,
        category: input.category,
        event: input.event,
        subject: input.subject,
        status: "SENDING",
        payload: input.payload ?? undefined,
      },
      select: { id: true },
    });
    logId = row.id;
  } catch (e) {
    logger.error({ err: e, event: input.event }, "email: failed to write EmailLog");
    // Continue — we still try to send; logging is best-effort.
  }

  let html: string;
  let text: string;
  try {
    ({ html, text } = await renderEmail(input.react));
  } catch (e) {
    await markFailed(logId, e, 0);
    logger.error({ err: e, event: input.event }, "email: render failed");
    return { ok: false, error: "render_failed" };
  }

  // Dry-run: exercise the whole pipeline without hitting Resend.
  if (isDryRun()) {
    logger.info({ event: input.event, to, subject: input.subject }, "email DRY-RUN (not sent)");
    await markSent(logId, "dry-run", 1);
    return { ok: true, id: "dry-run", skipped: true };
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const resend = getResend();
      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject: input.subject,
        html,
        text,
        replyTo: EMAIL_REPLY_TO,
      });

      if (error) {
        lastErr = error;
        if (isRetryable(error) && attempt < MAX_ATTEMPTS) {
          await sleep(BASE_BACKOFF_MS * attempt);
          continue;
        }
        await markFailed(logId, error, attempt);
        logger.error({ event: input.event, to, err: error }, "email: send failed");
        return { ok: false, error: (error as { name?: string }).name ?? "send_error" };
      }

      await markSent(logId, data?.id ?? null, attempt);
      logger.info({ event: input.event, to, id: data?.id }, "email sent");
      return { ok: true, id: data?.id };
    } catch (e) {
      lastErr = e;
      if (isRetryable(e) && attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * attempt);
        continue;
      }
      await markFailed(logId, e, attempt);
      logger.error({ event: input.event, to, err: e }, "email: send threw");
      return { ok: false, error: "exception" };
    }
  }

  await markFailed(logId, lastErr, MAX_ATTEMPTS);
  return { ok: false, error: "exhausted" };
}

async function markSent(logId: string | null, providerId: string | null, attempts: number) {
  if (!logId) return;
  await db.emailLog
    .update({
      where: { id: logId },
      data: { status: "SENT", providerMessageId: providerId, attempts, sentAt: new Date() },
    })
    .catch(() => {});
}

async function markFailed(logId: string | null, err: unknown, attempts: number) {
  if (!logId) return;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  await db.emailLog
    .update({
      where: { id: logId },
      data: { status: "FAILED", error: message.slice(0, 1000), attempts },
    })
    .catch(() => {});
}
