# TenderOS Product Analytics (PostHog)

Org-first product intelligence built for **decisions, not vanity metrics**. 20
curated events, server-first capture, strict no-PII, dormant-safe (no key ⇒ no
tracking, app unaffected).

## Architecture

```
src/lib/analytics/
├── posthog-server.ts   # lazy posthog-node (primary capture path)
├── posthog-client.ts   # posthog-js: pageviews, recordings, flags (autocapture OFF)
├── events.ts           # the 20-event taxonomy + property contracts
├── track.ts            # server capture: org context + group + PII sanitizer + flush
├── groups.ts           # organization group identify (plan/country/industry/size)
├── identify.ts         # person identify (userId only — never email/name)
└── flags.ts            # server-side, org-aware feature flags (Phase 9)
src/components/providers/
├── posthog-provider.tsx   # root: init + pageviews + digest_engaged loop
├── analytics-identify.tsx # (dashboard) layout: bind person + org group
└── analytics-capture.tsx  # one-shot client events (discovery_viewed)
```

**Server-first**: business events fire from the same action/webhook seams as
email, so payloads are curated (no content/PII) and immune to ad-blockers. The
client handles only pageviews, session recordings (fully masked), feature flags,
and identity binding. Client + server share the **`organization` group key = our
internal org id**, so every workspace's events roll up together.

## The 20 events (event name → where it fires)

| Event | Properties | Fires from |
|---|---|---|
| `workspace_created` | organizationType, country, employeeBand | `completeOnboarding` |
| `trial_started` | — | Stripe `checkout.session.completed` (trialing) |
| `tender_created` | sector, tenderType, hasDeadline | `createTender` |
| `requirements_extracted` | documentCount | extract-requirements (on completion) |
| `proposal_created` | tenderId, sectionCount, language | `createProposal` |
| `proposal_exported` | format | proposals export route |
| `team_member_invited` | invitedRole | `createInvitation` |
| `proposal_approved` | — | `approveProposal` |
| `discovery_viewed` | matchCount | /discover (client, on view) |
| `discovery_match_saved` | relevanceScore | `trackOpportunity` |
| `bid_score_generated` | recommendation, score, confidence | bid-decision route (on completion) |
| `bid_decision_recorded` | **outcome** (accepted\|overridden), decision | `recordBidDecision` |
| `compliance_generated` | rowCount | generate-compliance (on completion) |
| `rag_search` | hadResults | knowledge/ask |
| `document_uploaded` | fileType, sizeBucket | documents route |
| `subscription_changed` | **kind** (upgraded\|downgraded\|cancelled) | Stripe webhooks |
| `payment_failed` | — | Stripe `invoice.payment_failed` |
| `plan_limit_reached` | **limit_type** (ai_credit\|proposal\|seat) | quota fails in actions/routes |
| `digest_engaged` | action=clicked | `?ref=digest` landing (client) |
| `marketplace_connection_requested` | — | `requestConnection` |

Every event also carries `organizationId`, `organizationName`, `plan`, `role`
(Phase 2) and is attached to the `organization` group.

## Setup (activation — requires your action)

1. Create a PostHog project (US or EU cloud). Copy the **Project API key** (`phc_…`).
2. In Vercel → Settings → Environment Variables (Production):
   - `NEXT_PUBLIC_POSTHOG_KEY` = `phc_…`
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com` (or `eu`)
   - (`POSTHOG_KEY` optional — defaults to the public key; same project key works server-side.)
3. In PostHog → Settings, add a **Group Type** named `organization`.
4. Redeploy. Sign in, click around, send an invite — events appear under
   Activity, grouped by organization.

Until the key is set, every capture is a no-op. (Same dormant pattern as Stripe/Resend.)

## Dashboards to build in PostHog (Phases 6–8, 10)

Dashboards are PostHog-UI artifacts; below are exact definitions. (Insights can
also be created via the PostHog API with a personal key — out of scope here.)

**Activation funnel (Phase 3)** — Funnel insight, ordered steps, "by first time",
breakdown by group `organization` plan:
`workspace_created → tender_created → requirements_extracted → proposal_created → proposal_approved → proposal_exported`.
Read **Time-to-First-Value** off the funnel's step conversion-time;
**activation rate** = step-6 / step-1; **drop-off** = per-step.

**Retention (Phase 6)** — Retention insight on `discovery_viewed` OR any of
`proposal_created`/`requirements_extracted`, **aggregated by `organization`
group** (org retention, not user). Duplicate filtered by `plan` = Business /
Enterprise for plan & enterprise retention. Add Stickiness (DAU/WAU/MAU on the
same event set).

**Feature adoption (Phase 7)** — Bar of unique `organization` groups per feature
event over 30d: `discovery_viewed`, `bid_score_generated`, `proposal_created`,
`compliance_generated`, `rag_search`, `marketplace_connection_requested`,
`proposal_approved`. Low/zero bars = unused features. Power users = orgs in the
top decile of event volume.

**Executive / CEO (Phase 8)** — one dashboard:
- Active orgs = unique `organization` w/ any event (28d); Trial vs Paying =
  break the group by `plan_tier` (= STARTER vs paid).
- MRR/ARR = from Stripe (PostHog can ingest revenue, or pull from your DB).
- Activation rate, Retention, Churn = from the funnel + retention insights above.
- Avg proposals/org = `proposal_created` total ÷ active orgs.
- Avg AI usage = `requirements_extracted`+`compliance_generated`+`bid_score_generated`+`rag_search` ÷ orgs.
- Top features / industries / countries = event/group breakdowns by `industry`,
  `country` (group props).

**Product-Market Fit (Phase 10)** — a dashboard of the strongest signals:
- Orgs with **≥2** `proposal_created` (repeat value).
- Orgs **active after 30 days** (retention curve ≥ D30).
- Orgs with `team_member_invited` (it spreads).
- Orgs with **≥3** `discovery_viewed` weeks (habitual use).
- Orgs with `subscription_changed{kind:upgraded}` (willingness to pay).
The PMF core: % of orgs hitting ≥3 of these. Plus the **AI-trust ratio** =
`bid_decision_recorded{outcome:accepted}` ÷ all — rising = the model is earning trust.

## Feature flags (Phase 9)

Registry: `src/lib/analytics/flags.ts` (`FEATURE_FLAGS`). Create matching flags in
PostHog → Feature Flags. Evaluate server-side, org-aware:

```ts
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/analytics/flags";
if (await isFeatureEnabled(FEATURE_FLAGS.MARKETPLACE_BETA, userId, org.id)) { ... }
```

Target by group property (plan/country) for **gradual rollouts**, **plan-based
experiments**, and **A/B tests** (use `getFeatureFlag` for multivariate). Beta
access = release-condition on the `organization` group.

## Security (enforced in code)

- **No content / PII**: server `track()` runs a sanitizer that drops PII-ish
  keys, non-primitives, and over-long strings; autocapture is OFF; session
  recordings mask **all inputs and text**. No tender/proposal/BOQ values, no
  email/name are ever sent. distinct_id = Clerk user id only.
- **Multi-tenant**: every event is org-scoped + group-keyed; one workspace's data
  never mixes with another's.

## Scale to 100k+ orgs

PostHog ingestion scales independently; server capture uses `flushAt:1` so events
aren't lost in serverless. The 20-event ceiling keeps event volume — and your
PostHog bill — proportional to real usage, not vanity firehoses. Group-based
analysis means dashboards stay O(orgs), not O(users).
