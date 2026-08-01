import type { EmailCategory } from "@prisma/client";

/**
 * Email platform types — the event taxonomy and how each event maps to a
 * mutable preference category. This is the single source of truth shared by the
 * dispatcher, the preference gate, and the admin viewer.
 */

/** Every business event that can produce an email. */
export const NOTIFICATION_EVENTS = [
  "USER_INVITED",
  "WORKSPACE_CREATED",
  "TRIAL_STARTED",
  "TRIAL_EXPIRING",
  "PROPOSAL_GENERATED",
  "APPROVAL_REQUESTED",
  "APPROVAL_COMPLETED",
  "PAYMENT_FAILED",
  "SUBSCRIPTION_UPGRADED",
  "SUBSCRIPTION_CANCELLED",
  "INVOICE_ISSUED",
  "INVOICE_PAID",
  "NEW_DISCOVERY_MATCH",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/**
 * event → category. The category decides which preference toggle (if any) can
 * mute it. TRANSACTIONAL is never mutable — invites, welcome, and password
 * resets always send (a contractor must be able to receive the link they need).
 */
export const EVENT_CATEGORY: Record<NotificationEvent, EmailCategory> = {
  USER_INVITED: "TRANSACTIONAL",
  WORKSPACE_CREATED: "TRANSACTIONAL",
  TRIAL_STARTED: "BILLING",
  TRIAL_EXPIRING: "BILLING",
  PROPOSAL_GENERATED: "PROPOSAL",
  APPROVAL_REQUESTED: "APPROVAL",
  APPROVAL_COMPLETED: "APPROVAL",
  PAYMENT_FAILED: "BILLING",
  SUBSCRIPTION_UPGRADED: "BILLING",
  SUBSCRIPTION_CANCELLED: "BILLING",
  // An invoice and its receipt are financial documents the customer must
  // receive to pay / for their records — TRANSACTIONAL so they can never be
  // muted by a billing-notifications preference.
  INVOICE_ISSUED: "TRANSACTIONAL",
  INVOICE_PAID: "TRANSACTIONAL",
  NEW_DISCOVERY_MATCH: "DIGEST",
};

/** The NotificationPreference boolean column that gates each category. */
export const CATEGORY_PREFERENCE_FIELD: Record<
  EmailCategory,
  "dailyDigest" | "proposalNotifications" | "approvalNotifications" | "billingNotifications" | null
> = {
  TRANSACTIONAL: null, // never mutable
  DIGEST: "dailyDigest",
  PROPOSAL: "proposalNotifications",
  APPROVAL: "approvalNotifications",
  BILLING: "billingNotifications",
};

export function categoryFor(event: NotificationEvent): EmailCategory {
  return EVENT_CATEGORY[event];
}

// ── Recipient ─────────────────────────────────────────────────────────────────

export interface Recipient {
  /** Member id when the recipient is a workspace member (invitees have none). */
  memberId: string | null;
  email: string;
  name: string;
}

// ── Per-template render payloads (kept in sync with templates/*.tsx) ───────────

export interface InvitationPayload {
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}

export interface WelcomePayload {
  organizationName: string;
  recipientName: string;
  planName: string;
  dashboardUrl: string;
}

export interface ProposalReadyPayload {
  recipientName: string;
  proposalName: string;
  tenderName: string;
  proposalUrl: string;
}

export interface ApprovalRequestPayload {
  recipientName: string;
  proposalName: string;
  tenderName: string;
  requestorName: string;
  reviewUrl: string;
}

export interface TrialEndingPayload {
  organizationName: string;
  recipientName: string;
  daysLeft: number;
  endsOn: string;
  upgradeUrl: string;
}

export interface PaymentFailedPayload {
  organizationName: string;
  recipientName: string;
  amountDue: string | null;
  updatePaymentUrl: string;
}

export interface ApprovalResultPayload {
  recipientName: string;
  proposalName: string;
  tenderName: string;
  approverName: string;
  proposalUrl: string;
}

export interface SubscriptionChangePayload {
  organizationName: string;
  recipientName: string;
  planName: string;
  kind: "UPGRADED" | "CANCELLED" | "TRIAL_STARTED";
  trialEndsOn?: string | null;
  billingUrl: string;
}

export interface DigestOpportunity {
  title: string;
  buyerName: string | null;
  country: string | null;
  score: number; // 0..1
  closingDate: string | null; // ISO or null
  url: string;
}

export interface DailyDigestPayload {
  recipientName: string;
  organizationName: string;
  opportunities: DigestOpportunity[];
  discoverUrl: string;
}

export interface PasswordResetPayload {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/** One line on the invoice, pre-formatted for display (no math in the template). */
export interface InvoiceLineItemView {
  description: string;
  quantity: number;
  /** Already-formatted currency string, e.g. "$1,299.00". */
  amount: string;
}

export interface InvoiceIssuedPayload {
  organizationName: string;
  recipientName: string;
  invoiceNumber: string;
  planName: string;
  billingCycle: string; // "monthly" | "annual"
  amountDue: string; // formatted "$1,299.00"
  dueDate: string; // formatted
  periodLabel: string; // "Jan 1 – Jan 31, 2026"
  lineItems: InvoiceLineItemView[];
  paymentInstructions: string | null;
  invoiceUrl: string; // /settings/billing
}

export interface InvoicePaidPayload {
  organizationName: string;
  recipientName: string;
  invoiceNumber: string;
  planName: string;
  amountPaid: string; // formatted
  paidDate: string; // formatted
  invoiceUrl: string;
}
