import { Resend } from "resend";

/**
 * Resend client — lazily constructed so a missing RESEND_API_KEY never throws at
 * import/build time (same contract as the S3 and AI clients). Email is an
 * OPTIONAL capability: when unconfigured, the platform degrades to a no-op
 * (see send-email.ts) instead of crashing a request or a cron.
 */

let _resend: Resend | null = null;

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

/** True when a real API key is present. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Dry-run: render + log but never call Resend. Set EMAIL_DRY_RUN=1 in
 * preview/staging to exercise the whole pipeline without sending real mail.
 */
export function isDryRun(): boolean {
  return process.env.EMAIL_DRY_RUN === "1";
}

/** Sending is "live" only when configured AND not in dry-run. */
export function isEmailLive(): boolean {
  return isEmailConfigured() && !isDryRun();
}

/**
 * From / Reply-To. Override via env once the sending domain is verified in
 * Resend. The default uses the verified-domain convention for thetenderos.com;
 * support@ is the monitored mailbox replies should land in.
 */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "TenderOS <noreply@thetenderos.com>";
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO ?? "support@thetenderos.com";

/** Resend's batch endpoint caps at 100 messages per call. */
export const RESEND_BATCH_MAX = 100;
