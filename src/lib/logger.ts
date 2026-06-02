/**
 * Structured Logger for TenderOS
 *
 * Uses pino for fast, JSON-structured logging.
 * In development: pretty-printed human-readable output.
 * In production: JSON output compatible with Vercel's log aggregation,
 *                Datadog, Grafana Loki, or any log management platform.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId, orgId, action: "document.upload" }, "Document uploaded");
 *   logger.error({ err, documentId }, "Processing failed");
 */

import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),

  // In development, use pretty printing
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),

  // Base fields added to every log line
  base: {
    app: "tenderos",
    env: process.env.NODE_ENV,
    version: process.env.npm_package_version ?? "0.1.0",
  },

  // Redact sensitive fields from logs
  redact: {
    paths: [
      "*.password",
      "*.token",
      "*.secret",
      "*.apiKey",
      "*.mfaSecret",
      "authorization",
      "cookie",
    ],
    censor: "[REDACTED]",
  },

  // Standard serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with context.
 * Use per-request for tracing.
 */
export function createRequestLogger(context: {
  requestId?: string;
  userId?: string;
  orgId?: string;
  path?: string;
  method?: string;
}) {
  return logger.child(context);
}

/**
 * Log an AI job event.
 */
export function logAIJob(
  jobId: string,
  event: "started" | "completed" | "failed" | "retrying",
  metadata: Record<string, unknown> = {}
) {
  const level = event === "failed" ? "error" : "info";
  logger[level]({ jobId, event, ...metadata }, `AI job ${event}`);
}

/**
 * Log a security event (for audit purposes).
 */
export function logSecurityEvent(
  event:
    | "auth.login"
    | "auth.logout"
    | "auth.failed"
    | "permission.denied"
    | "rate_limit.exceeded"
    | "api_key.invalid",
  context: Record<string, unknown> = {}
) {
  logger.warn({ securityEvent: event, ...context }, `Security event: ${event}`);
}

/**
 * Log a billing event.
 */
export function logBillingEvent(
  event: "subscription.created" | "subscription.upgraded" | "trial.expired" | "payment.failed",
  orgId: string,
  metadata: Record<string, unknown> = {}
) {
  logger.info({ billingEvent: event, orgId, ...metadata }, `Billing: ${event}`);
}
