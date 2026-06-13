# TenderOS Email Infrastructure (Resend)

Production-grade transactional + notification email, multi-tenant safe, built to
ride the existing systems (invitations, onboarding, approvals, billing,
discovery) rather than duplicate them.

## Architecture at a glance

```
src/lib/email/
├── resend.ts        # lazy Resend client + env (no key ⇒ safe no-op, never throws)
├── types.ts         # NotificationEvent taxonomy + event→category map
├── send-email.ts    # render → EmailLog → send, retry/backoff, dry-run, fail-safe
├── email-queue.ts   # outbox + Resend batch drainer (the high-volume digest path)
├── events.ts        # dispatchNotification helpers — the ONE public API
├── recipients.ts    # org-scoped recipient resolution, preference-gated
├── preferences.ts   # NotificationPreference data layer
├── digest.ts        # daily digest builder (rides the discovery cron)
├── trial.ts         # 7/3/1-day trial-expiry sweep
└── templates/       # React Email templates (HTML + auto plain-text)
```

**Two delivery paths:**
- **Immediate** (low volume, time-sensitive): invites, welcome, approvals,
  billing → `sendEmail()` with retry, logged `SENT`/`FAILED`.
- **Queued** (high volume): the daily digest → `enqueueEmail()` writes `EmailLog`
  rows as `QUEUED`, then `drainEmailQueue()` sends them with Resend's **batch**
  endpoint in rate-limited chunks. The `EmailLog` table *is* the queue.

**Event wiring (reuse, no duplication):**

| Event | Fired from | Template |
|---|---|---|
| `USER_INVITED` | `actions/invitations.ts` (after success, raw token) | invitation |
| `WORKSPACE_CREATED` | `actions/onboarding.ts` `completeOnboarding` | welcome |
| `APPROVAL_REQUESTED` | `actions/proposal-review.ts` `submitProposalForReview` | approval-request |
| `APPROVAL_COMPLETED` | `actions/proposal-review.ts` `approveProposal` | approval-result |
| `PROPOSAL_GENERATED` | `notifyProposalReady()` (exposed for a full-proposal generator) | proposal-ready |
| `PAYMENT_FAILED` | `webhooks/stripe` `invoice.payment_failed` | payment-failed |
| `SUBSCRIPTION_UPGRADED` / `TRIAL_STARTED` | `webhooks/stripe` `checkout.session.completed` | subscription-change |
| `SUBSCRIPTION_CANCELLED` | `webhooks/stripe` `customer.subscription.deleted` | subscription-change |
| `TRIAL_EXPIRING` | `email/trial.ts` (daily, via discovery cron) | trial-ending |
| `NEW_DISCOVERY_MATCH` | `discovery/refresh.ts` ALERT phase (same deduped set) | daily-digest |

The daily digest **reuses the discovery cron's existing dedup**: matches are
gated on `OpportunityMatch.lastNotifiedAt IS NULL` and that timestamp is stamped
after delivery, so each match is emailed at most once — that is the "store
last-delivered timestamp / avoid duplicates" requirement, already in place.

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production).
**Never commit real keys.** Add the same names to `.env.local` for local dev.

| Var | Required | Example | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | to send | `re_xxx` | Without it, the platform records nothing and sends nothing (safe no-op). |
| `EMAIL_FROM` | recommended | `TenderOS <noreply@thetenderos.com>` | Must be on a **verified** Resend domain. |
| `EMAIL_REPLY_TO` | optional | `support@thetenderos.com` | The monitored mailbox. |
| `EMAIL_DRY_RUN` | optional | `1` | Render + log but never call Resend (staging). |
| `NEXT_PUBLIC_APP_URL` | yes (exists) | `https://www.thetenderos.com` | Used for absolute links in emails. |

## One-time Resend setup

1. Create a Resend account; add the domain **thetenderos.com**.
2. Add the DNS records Resend shows (SPF, DKIM, and a DMARC record) at your DNS
   provider. Wait for "Verified".
   - SPF: `TXT @  v=spf1 include:amazonses.com ~all` (or as Resend specifies)
   - DKIM: the CNAME/TXT records Resend generates
   - DMARC: `TXT _dmarc  v=DMARC1; p=none; rua=mailto:dmarc@thetenderos.com`
3. Create an API key (Sending access) → set `RESEND_API_KEY` in Vercel.
4. Set `EMAIL_FROM` to a `@thetenderos.com` sender on the verified domain.
5. Redeploy. Send a test invite; confirm it lands and appears under
   **Settings → Email** as `SENT`.

> Until the domain is verified and the key is set, every event is a clean no-op —
> the app is fully deployable in this dormant state (same pattern as Stripe/OCR).

## Delivery webhooks (optional but recommended)

To flip rows from `SENT` → `DELIVERED`/`BOUNCED`/`COMPLAINED`, add a Resend
webhook to `POST /api/webhooks/resend` (handler not included here — add when you
want delivery confirmation) and verify its signature with `svix` (already a
dependency, used for Clerk). Match events back via `EmailLog.providerMessageId`.

## Preferences & security

- **Preferences** are per-member (`NotificationPreference`), self-service at
  **Settings → Notifications**. `TRANSACTIONAL` mail (invites, welcome, password
  reset) ignores preferences by design.
- **No enumeration**: invite/transactional flows never reveal whether an address
  is a user. Password reset is **Clerk-owned** in the hosted app (Clerk already
  issues secure, enumeration-safe reset links) — the `password-reset` template is
  for the self-hosted Keycloak edition / a future first-party flow and is **not**
  wired to a custom token issuer here.
- **Signed/expiring invite links**: reused as-is — tokens are stored
  `sha256`-hashed with a 7-day TTL; a DB leak never yields a usable link.
- **HTML + plain-text**: every template renders both (`@react-email/render`).
- **Audit**: `EmailLog` is the per-email delivery audit; security-significant
  triggers (e.g. invitations) also hit the existing `logAudit` trail.

## Admin viewer

**Settings → Email** (ADMIN+): per-workspace activity, status summary (sent /
queued / failed), filter by status + window, and inline error text on failures.
Strictly org-scoped.

## Scaling to 100k+ organizations

- The digest is **fan-out per recipient** but bounded: the discovery cron
  processes `MAX_ORGS_PER_RUN` orgs/run and `drainEmailQueue()` sends in
  `RESEND_BATCH_MAX` (100) chunks. Raise these as volume grows.
- The outbox (`EmailLog` QUEUED) decouples produce from send. At high scale,
  move the drain off the Vercel cron to a dedicated worker (QStash / SQS) and
  upgrade row claiming to `SELECT … FOR UPDATE SKIP LOCKED` for multi-worker
  safety — **no schema change required**, just a new drain trigger.
- Mind Resend plan rate limits; the retry/backoff in `send-email.ts` already
  handles `429`/5xx transient failures.
- On **Vercel Hobby**, crons are daily-only; the digest and trial sweep both ride
  the existing daily discovery cron. Sub-daily cadence needs Vercel Pro.

## Local testing

```bash
# Dry-run the whole pipeline without sending (rows logged, nothing delivered):
EMAIL_DRY_RUN=1 RESEND_API_KEY=re_dummy npm run dev
```

Trigger an invite from Settings → Members and watch the server log + Settings →
Email. Set a real `RESEND_API_KEY` (and remove `EMAIL_DRY_RUN`) to send for real.
