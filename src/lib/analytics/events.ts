/**
 * TenderOS analytics taxonomy — the 20 events that drive product, growth, and
 * revenue decisions. Curated deliberately: related actions are consolidated into
 * one event with a discriminating property (e.g. subscription_changed{kind})
 * rather than many thin events, because that is what makes funnels, ratios, and
 * cohorts tractable. PostHog derives first-occurrence / Time-to-First-Value
 * natively, so there are NO separate FIRST_* events.
 *
 * SECURITY: event names + the property types below are the ONLY shape allowed to
 * leave the server. No tender/proposal/BOQ content, no PII — see track.ts.
 */

export const ANALYTICS_EVENTS = {
  // ── Activation funnel ───────────────────────────────────────────────
  WORKSPACE_CREATED: "workspace_created",
  TRIAL_STARTED: "trial_started",
  TENDER_CREATED: "tender_created",
  REQUIREMENTS_EXTRACTED: "requirements_extracted",
  PROPOSAL_CREATED: "proposal_created",
  PROPOSAL_EXPORTED: "proposal_exported",
  // ── Spread & workflow ───────────────────────────────────────────────
  TEAM_MEMBER_INVITED: "team_member_invited",
  PROPOSAL_APPROVED: "proposal_approved",
  // ── Discovery ───────────────────────────────────────────────────────
  DISCOVERY_VIEWED: "discovery_viewed",
  DISCOVERY_MATCH_SAVED: "discovery_match_saved",
  // ── Bid qualification ───────────────────────────────────────────────
  BID_SCORE_GENERATED: "bid_score_generated",
  BID_DECISION_RECORDED: "bid_decision_recorded", // outcome: accepted | overridden
  // ── Other engine adoption ───────────────────────────────────────────
  COMPLIANCE_GENERATED: "compliance_generated",
  RAG_SEARCH: "rag_search",
  DOCUMENT_UPLOADED: "document_uploaded",
  // ── Revenue ─────────────────────────────────────────────────────────
  SUBSCRIPTION_CHANGED: "subscription_changed", // kind: upgraded | downgraded | cancelled
  PAYMENT_FAILED: "payment_failed",
  PLAN_LIMIT_REACHED: "plan_limit_reached", // limit_type: ai_credit | proposal | seat
  // ── Loop & moat ─────────────────────────────────────────────────────
  DIGEST_ENGAGED: "digest_engaged", // action: clicked
  MARKETPLACE_CONNECTION_REQUESTED: "marketplace_connection_requested",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * The org-first context attached to EVERY event (Phase 2). organizationId
 * doubles as the PostHog `organization` group key, so all server + client events
 * for a workspace roll up together.
 */
export interface AnalyticsContext {
  /** Stable person id — the Clerk (or OIDC) user id. Never an email. */
  userId: string;
  /** PostHog `organization` group key + event property. Our internal org id. */
  organizationId: string;
  organizationName: string;
  plan: string; // PlanTier label, e.g. "Professional"
  role: string; // MemberRole, e.g. "OWNER"
}

/** Allowed, non-sensitive property values. Enforced by the sanitizer in track.ts. */
export type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;

/**
 * Property contracts per event (documentation + light typing). Keep these
 * metadata-only — counts, enums, ids of our own rows — never content.
 */
export interface EventPropertyMap {
  [ANALYTICS_EVENTS.WORKSPACE_CREATED]: { organizationType?: string; country?: string; employeeBand?: string };
  [ANALYTICS_EVENTS.TRIAL_STARTED]: { trialDays?: number };
  [ANALYTICS_EVENTS.TENDER_CREATED]: { sector?: string; tenderType?: string; hasDeadline?: boolean };
  [ANALYTICS_EVENTS.REQUIREMENTS_EXTRACTED]: { requirementCount?: number; documentCount?: number };
  [ANALYTICS_EVENTS.PROPOSAL_CREATED]: { tenderId?: string; sectionCount?: number; language?: string };
  [ANALYTICS_EVENTS.PROPOSAL_EXPORTED]: { format?: string };
  [ANALYTICS_EVENTS.TEAM_MEMBER_INVITED]: { invitedRole?: string };
  [ANALYTICS_EVENTS.PROPOSAL_APPROVED]: { tenderId?: string };
  [ANALYTICS_EVENTS.DISCOVERY_VIEWED]: { matchCount?: number };
  [ANALYTICS_EVENTS.DISCOVERY_MATCH_SAVED]: { relevanceScore?: number };
  [ANALYTICS_EVENTS.BID_SCORE_GENERATED]: { recommendation?: string; score?: number; confidence?: number };
  [ANALYTICS_EVENTS.BID_DECISION_RECORDED]: { outcome: "accepted" | "overridden"; decision?: string };
  [ANALYTICS_EVENTS.COMPLIANCE_GENERATED]: { rowCount?: number };
  [ANALYTICS_EVENTS.RAG_SEARCH]: { hadResults?: boolean };
  [ANALYTICS_EVENTS.DOCUMENT_UPLOADED]: { fileType?: string; sizeBucket?: string };
  [ANALYTICS_EVENTS.SUBSCRIPTION_CHANGED]: { kind: "upgraded" | "downgraded" | "cancelled"; fromPlan?: string; toPlan?: string };
  [ANALYTICS_EVENTS.PAYMENT_FAILED]: Record<string, never>;
  [ANALYTICS_EVENTS.PLAN_LIMIT_REACHED]: { limit_type: "ai_credit" | "proposal" | "seat" };
  [ANALYTICS_EVENTS.DIGEST_ENGAGED]: { action: "clicked" };
  [ANALYTICS_EVENTS.MARKETPLACE_CONNECTION_REQUESTED]: Record<string, never>;
}
