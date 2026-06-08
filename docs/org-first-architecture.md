# TenderOS — Organization-First Architecture

> **Core principle:** _The company is the customer. The individual user is only a
> member._ Every account, subscription, document, and AI artifact belongs to an
> **Organization** (the workspace). A person has no standalone account — they
> exist only as a `Member` of one or more organizations.

This document maps the 10 architecture deliverables to the implementation in this
repo. It is the canonical reference for how signup, onboarding, auth, billing,
and team management hang together.

---

## 1. Data model (Prisma)

`prisma/schema.prisma`

```
Organization (tenant root)
  ├─ Member[]            (people, each with a MemberRole)
  ├─ Invitation[]        (link-based team invites)
  ├─ Subscription?       (one plan per org)
  └─ everything else     (Tender, Proposal, KnowledgeChunk, BoqWorkflow,
                          AIFeedback, …) — all carry orgId
```

Key org fields added for the org-first flow:

| Field | Purpose |
|---|---|
| `organizationType` (`OrganizationType` enum) | Onboarding Step 1 — GC / EPC / Consultant / Gov / Supplier / … |
| `employeeCount` (banded string) | Company size band |
| `countryCode` (`Char(2)`) | ISO 3166-1 — MENA-first |
| `website` | Company site |
| `onboardingCompletedAt` | **The gate.** Null ⇒ workspace not yet set up |
| `planTier`, `maxSeats`, `maxProposalsMonth`, `aiCreditsMonth`, `storageBytes*` | Plan entitlements, enforced per org |
| `trialEndsAt` | 14-day trial |

`OrganizationType` enum: `GENERAL_CONTRACTOR · EPC_CONTRACTOR ·
CONSTRUCTION_COMPANY · ENGINEERING_CONSULTANT · FACILITIES_MANAGEMENT ·
GOVERNMENT_AGENCY · SUPPLIER_VENDOR · OTHER`.

## 2. Relationships

- **Organization 1—N Member.** `Member` is unique on `(orgId, clerkUserId)` and
  `(orgId, email)` — the same human can be a member of several orgs, but only
  once per org.
- **Organization 1—1 Subscription.** Billing is a property of the company, never
  a person.
- **Organization 1—N Invitation,** unique on `(orgId, email)` — one live invite
  per email per workspace.
- **All tenant tables → `orgId`.** Cascade-delete from `Organization` so removing
  a workspace removes its world cleanly.

## 3. Authentication architecture

Provider-seam pattern — one app, two editions, switched by `AUTH_PROVIDER`:

| Edition | Provider | Source of truth for membership |
|---|---|---|
| Cloud (SaaS) | **Clerk Organizations** | Clerk org + our `Member` mirror |
| Air-gapped | **OIDC / Keycloak** (`src/lib/auth/oidc.ts`) | IdP groups → roles |

`getAuthContext()` (`src/lib/auth.ts`) is the single entry point. It resolves the
active org from the session, lazily creates the `Organization`/`Member` mirror
rows on first sign-in (handles the webhook race), and **redirects to `/sign-in`
if no valid org/member**. `isOidcAuth()` (`src/lib/auth/mode.ts`) branches
provider-specific behavior.

## 4. Role-based access control

`MemberRole` hierarchy (high → low), enforced by `hasRole()` / `requireRole()`:

```
OWNER > ADMIN > MANAGER > SENIOR_WRITER > WRITER > REVIEWER > VIEWER
```

- **OWNER** — billing, delete workspace, mint ADMINs.
- **ADMIN** — full access except billing-destructive; invite up to MANAGER.
- **MANAGER** — tenders, assignments.
- **SENIOR_WRITER / WRITER** — drafting.
- **REVIEWER** — comment / approve.
- **VIEWER** — read-only.

Server actions call `requireRole(member.role, "ADMIN")` before any privileged
mutation (onboarding, invitations). RBAC is checked **server-side**, never trusted
from the client.

## 5. Invitation system (link-based, app-native)

`src/lib/actions/invitations.ts`, `accept-invitation.ts`; UI in
`src/components/settings/{invite-member-dialog,pending-invitations}.tsx`; accept
flow at `/invite/[token]`.

- **Why link-based:** works identically in cloud and air-gapped — no external
  email dependency. An ADMIN generates a tokenized, role-scoped, 7-day link.
- **Security:** token is 24 bytes of CSPRNG (`randomBytes(24).base64url`). The
  invite is bound to a specific email; accept **requires the signed-in email to
  match**. Every read/write is scoped to the caller's `orgId`, so a token from
  another tenant is inert. ADMIN role can only be granted by an OWNER.
- **Lifecycle:** `PENDING → ACCEPTED | REVOKED | EXPIRED`. On accept (cloud) the
  user is added to the Clerk org at the mapped role, the `Member` row is ensured,
  and the workspace is set active. OIDC defers to IdP provisioning.

## 6. Subscription architecture

- **One `Subscription` per `Organization`.** Plan tier drives entitlements
  (`maxSeats`, `maxProposalsMonth`, `aiCreditsMonth`, storage) read off the org.
- **Billing is org-scoped:** only OWNER reaches billing. Stripe checkout/portal/
  webhooks operate on the org's customer; the 14-day trial is the default initial
  state (`trialEndsAt`).
- Onboarding Step 2 selects the plan (Professional recommended); the card-on-file
  step is deferred — trial starts immediately, upgrade happens in
  `/settings/billing`.

## 7. Multi-tenant security

- **`orgId` on every tenant row** + pre-rank `WHERE orgId = $1` bound parameter in
  RAG search (`src/lib/security/rag-search.ts`) so vector retrieval can never
  cross tenants.
- **`getAuthContext()` is the choke point** — all dashboard routes resolve the org
  through it; the `(dashboard)` layout gates on it.
- **Server actions re-derive `orgId` from auth**, never from client input. Mutations
  use `updateMany({ where: { id, orgId } })` so a forged id from another tenant is
  a silent no-op.
- **Cascade deletes** keep teardown clean and prevent orphaned cross-tenant rows.

## 8. Onboarding flow

Route: `src/app/onboarding/` · actions: `src/lib/actions/onboarding.ts` · gate in
`src/app/(dashboard)/layout.tsx`.

1. **Create Company Workspace** — name, organization type, country, employee
   count, website (`saveCompanyProfile`).
2. **Choose Plan** — Starter / Professional (recommended) / Business; 14-day trial.
3. **Get Started** — live setup checklist (invite team, upload tender, add
   historical docs, generate a proposal) → `completeOnboarding` sets
   `onboardingCompletedAt` and lifts the gate.

**The gate:** `(dashboard)/layout.tsx` redirects to `/onboarding` whenever
`org.onboardingCompletedAt` is null. Existing workspaces were backfilled, so only
brand-new companies see the wizard.

## 9. Folder structure

```
src/
  app/
    (auth)/         sign-in, sign-up                    — Clerk
    onboarding/     org-first setup wizard (gated)
    invite/[token]/ link-based invite accept (public)
    (dashboard)/    product — layout gates on onboardingCompletedAt
      settings/members/   team + invitations
      settings/billing/   org subscription (OWNER)
    (marketing)/    public site + pricing
  lib/
    auth.ts            getAuthContext / hasRole / requireRole
    auth/oidc.ts       air-gapped OIDC adapter
    auth/mode.ts       isOidcAuth()
    actions/
      onboarding.ts        saveCompanyProfile, completeOnboarding
      invitations.ts       create / list / revoke
      accept-invitation.ts accept (Clerk membership join)
  components/
    onboarding/     onboarding-wizard, accept-invitation-card
    settings/       invite-member-dialog, pending-invitations, members-list
```

## 10. Enterprise best practices applied

- **Tenant isolation by construction** — orgId everywhere + bound-param pre-rank +
  server-derived auth context.
- **Least privilege RBAC** — 7-tier hierarchy, server-enforced, owner-gated
  escalation.
- **Provider seams** — auth (Clerk | OIDC), LLM, embeddings, OCR all env-switched;
  the org-first model is identical cloud vs. air-gapped.
- **Idempotent, race-safe provisioning** — lazy mirror creation, `upsert` on
  invite accept, no-op cross-tenant mutations.
- **Auditability** — Invitation lifecycle (who/when/role) + immutable `AuditLog`.
- **Graceful state machine** — invites and onboarding both model explicit states
  rather than booleans, so expiry/revocation/backfill are first-class.
```
