import "server-only";
import * as React from "react";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { APP_URL, PLAN_LIMITS } from "@/lib/constants";
import { sendEmail } from "./send-email";
import { resolveRecipients, ROLE_SETS } from "./recipients";
import { categoryFor, type NotificationEvent, type Recipient } from "./types";

import InvitationEmail, { subject as invitationSubject } from "./templates/invitation";
import WelcomeEmail, { subject as welcomeSubject } from "./templates/welcome";
import ProposalReadyEmail, { subject as proposalReadySubject } from "./templates/proposal-ready";
import ApprovalRequestEmail, { subject as approvalRequestSubject } from "./templates/approval-request";
import ApprovalResultEmail, { subject as approvalResultSubject } from "./templates/approval-result";
import TrialEndingEmail, { subject as trialEndingSubject } from "./templates/trial-ending";
import SubscriptionChangeEmail, { subject as subChangeSubject } from "./templates/subscription-change";
import PaymentFailedEmail, { subject as paymentFailedSubject } from "./templates/payment-failed";

/**
 * Event-driven dispatch — the ONE public API the rest of the app calls when
 * something happens ("an invite was created", "a proposal was approved"). Each
 * helper resolves recipients (org-scoped + preference-gated), renders the right
 * template, and sends best-effort. Nothing here throws: every helper is safe to
 * call inside next/server `after()` without risk to the triggering mutation.
 *
 * Daily-digest fan-out is the one high-volume path and lives in ./email-queue +
 * ./digest (outbox + batch), not here.
 */

const billingUrl = `${APP_URL}/settings/billing`;

function planLabel(tier: keyof typeof PLAN_LIMITS): string {
  return PLAN_LIMITS[tier]?.label ?? "your";
}

async function safe(event: NotificationEvent, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error({ err, event }, "email dispatch failed");
  }
}

// ── USER_INVITED ──────────────────────────────────────────────────────────────
export function notifyUserInvited(args: {
  orgId: string;
  toEmail: string;
  organizationName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}): Promise<void> {
  return safe("USER_INVITED", async () => {
    const payload = {
      organizationName: args.organizationName,
      inviterName: args.inviterName,
      role: args.role,
      acceptUrl: args.acceptUrl,
      expiresInDays: args.expiresInDays,
    };
    await sendEmail({
      orgId: args.orgId,
      to: args.toEmail,
      event: "USER_INVITED",
      category: categoryFor("USER_INVITED"),
      subject: invitationSubject(payload),
      react: React.createElement(InvitationEmail, payload),
      payload: { role: args.role, organizationName: args.organizationName },
    });
  });
}

// ── WORKSPACE_CREATED (welcome) ───────────────────────────────────────────────
export function notifyWorkspaceCreated(args: { orgId: string; memberId: string }): Promise<void> {
  return safe("WORKSPACE_CREATED", async () => {
    const org = await db.organization.findUnique({
      where: { id: args.orgId },
      select: { name: true, planTier: true },
    });
    const member = await db.member.findFirst({
      where: { id: args.memberId, orgId: args.orgId, isActive: true },
      select: { email: true, name: true },
    });
    if (!org || !member) return;

    const payload = {
      organizationName: org.name,
      recipientName: member.name,
      planName: planLabel(org.planTier),
      dashboardUrl: `${APP_URL}/dashboard`,
    };
    await sendEmail({
      orgId: args.orgId,
      memberId: args.memberId,
      to: member.email,
      event: "WORKSPACE_CREATED",
      category: categoryFor("WORKSPACE_CREATED"),
      subject: welcomeSubject(payload),
      react: React.createElement(WelcomeEmail, payload),
      payload: { plan: payload.planName },
    });
  });
}

// ── APPROVAL_REQUESTED ────────────────────────────────────────────────────────
export function notifyApprovalRequested(args: {
  orgId: string;
  proposalId: string;
  requestorMemberId: string;
}): Promise<void> {
  return safe("APPROVAL_REQUESTED", async () => {
    const proposal = await loadProposalContext(args.orgId, args.proposalId);
    if (!proposal) return;

    const requestor = await db.member.findFirst({
      where: { id: args.requestorMemberId, orgId: args.orgId },
      select: { name: true },
    });

    // MANAGER+ approvers, minus the person who submitted, who have approvals on.
    const recipients = (
      await resolveRecipients(args.orgId, { roles: ROLE_SETS.MANAGERS_PLUS, category: "APPROVAL" })
    ).filter((r) => r.memberId !== args.requestorMemberId);

    await fanOut(args.orgId, "APPROVAL_REQUESTED", recipients, (r) => {
      const payload = {
        recipientName: r.name,
        proposalName: proposal.title,
        tenderName: proposal.tenderName,
        requestorName: requestor?.name ?? "A teammate",
        reviewUrl: proposal.url,
      };
      return { subject: approvalRequestSubject(payload), react: React.createElement(ApprovalRequestEmail, payload) };
    });
  });
}

// ── APPROVAL_COMPLETED ────────────────────────────────────────────────────────
export function notifyApprovalCompleted(args: {
  orgId: string;
  proposalId: string;
  approverMemberId: string;
}): Promise<void> {
  return safe("APPROVAL_COMPLETED", async () => {
    const proposal = await loadProposalContext(args.orgId, args.proposalId);
    if (!proposal || !proposal.createdById || proposal.createdById === args.approverMemberId) return;

    const approver = await db.member.findFirst({
      where: { id: args.approverMemberId, orgId: args.orgId },
      select: { name: true },
    });

    // Notify the author, if they have approval notifications enabled.
    const eligible = await resolveRecipients(args.orgId, { category: "APPROVAL" });
    const author = eligible.find((r) => r.memberId === proposal.createdById);
    if (!author) return;

    const payload = {
      recipientName: author.name,
      proposalName: proposal.title,
      tenderName: proposal.tenderName,
      approverName: approver?.name ?? "Your manager",
      proposalUrl: proposal.url,
    };
    await sendEmail({
      orgId: args.orgId,
      memberId: author.memberId,
      to: author.email,
      event: "APPROVAL_COMPLETED",
      category: categoryFor("APPROVAL_COMPLETED"),
      subject: approvalResultSubject(payload),
      react: React.createElement(ApprovalResultEmail, payload),
      payload: { proposalId: args.proposalId },
    });
  });
}

// ── PROPOSAL_GENERATED ────────────────────────────────────────────────────────
// Exposed for a future "generate full proposal" orchestrator (today's UX drafts
// sections individually via client SSE, with no server completion event).
export function notifyProposalReady(args: { orgId: string; proposalId: string }): Promise<void> {
  return safe("PROPOSAL_GENERATED", async () => {
    const proposal = await loadProposalContext(args.orgId, args.proposalId);
    if (!proposal || !proposal.createdById) return;

    const eligible = await resolveRecipients(args.orgId, { category: "PROPOSAL" });
    const author = eligible.find((r) => r.memberId === proposal.createdById);
    if (!author) return;

    const payload = {
      recipientName: author.name,
      proposalName: proposal.title,
      tenderName: proposal.tenderName,
      proposalUrl: proposal.url,
    };
    await sendEmail({
      orgId: args.orgId,
      memberId: author.memberId,
      to: author.email,
      event: "PROPOSAL_GENERATED",
      category: categoryFor("PROPOSAL_GENERATED"),
      subject: proposalReadySubject(payload),
      react: React.createElement(ProposalReadyEmail, payload),
      payload: { proposalId: args.proposalId },
    });
  });
}

// ── PAYMENT_FAILED ────────────────────────────────────────────────────────────
export function notifyPaymentFailed(args: { orgId: string; amountDue?: string | null }): Promise<void> {
  return safe("PAYMENT_FAILED", async () => {
    const org = await db.organization.findUnique({ where: { id: args.orgId }, select: { name: true } });
    if (!org) return;
    const recipients = await resolveRecipients(args.orgId, {
      roles: ROLE_SETS.ADMINS,
      category: "BILLING",
    });
    await fanOut(args.orgId, "PAYMENT_FAILED", recipients, (r) => {
      const payload = {
        organizationName: org.name,
        recipientName: r.name,
        amountDue: args.amountDue ?? null,
        updatePaymentUrl: billingUrl,
      };
      return { subject: paymentFailedSubject(payload), react: React.createElement(PaymentFailedEmail, payload) };
    });
  });
}

// ── TRIAL_EXPIRING (7 / 3 / 1 days before) ────────────────────────────────────
export function notifyTrialExpiring(args: {
  orgId: string;
  daysLeft: number;
  endsOn: string;
}): Promise<void> {
  return safe("TRIAL_EXPIRING", async () => {
    const org = await db.organization.findUnique({ where: { id: args.orgId }, select: { name: true } });
    if (!org) return;
    const recipients = await resolveRecipients(args.orgId, {
      roles: ROLE_SETS.ADMINS,
      category: "BILLING",
    });
    await fanOut(args.orgId, "TRIAL_EXPIRING", recipients, (r) => {
      const payload = {
        organizationName: org.name,
        recipientName: r.name,
        daysLeft: args.daysLeft,
        endsOn: args.endsOn,
        upgradeUrl: billingUrl,
      };
      return { subject: trialEndingSubject(payload), react: React.createElement(TrialEndingEmail, payload) };
    });
  });
}

// ── TRIAL_STARTED / SUBSCRIPTION_UPGRADED / SUBSCRIPTION_CANCELLED ─────────────
export function notifySubscriptionChange(args: {
  orgId: string;
  kind: "TRIAL_STARTED" | "UPGRADED" | "CANCELLED";
  trialEndsOn?: string | null;
}): Promise<void> {
  const event: NotificationEvent =
    args.kind === "TRIAL_STARTED"
      ? "TRIAL_STARTED"
      : args.kind === "UPGRADED"
        ? "SUBSCRIPTION_UPGRADED"
        : "SUBSCRIPTION_CANCELLED";

  return safe(event, async () => {
    const org = await db.organization.findUnique({
      where: { id: args.orgId },
      select: { name: true, planTier: true },
    });
    if (!org) return;
    const recipients = await resolveRecipients(args.orgId, {
      roles: ROLE_SETS.ADMINS,
      category: "BILLING",
    });
    await fanOut(args.orgId, event, recipients, (r) => {
      const payload = {
        organizationName: org.name,
        recipientName: r.name,
        planName: planLabel(org.planTier),
        kind: args.kind,
        trialEndsOn: args.trialEndsOn ?? null,
        billingUrl,
      };
      return { subject: subChangeSubject(payload), react: React.createElement(SubscriptionChangeEmail, payload) };
    });
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface ProposalContext {
  title: string;
  tenderName: string;
  tenderId: string;
  createdById: string | null;
  url: string;
}

async function loadProposalContext(orgId: string, proposalId: string): Promise<ProposalContext | null> {
  const p = await db.proposal.findFirst({
    where: { id: proposalId, orgId, deletedAt: null },
    select: {
      title: true,
      createdById: true,
      tender: { select: { id: true, titleEn: true } },
    },
  });
  if (!p) return null;
  return {
    title: p.title,
    tenderName: p.tender.titleEn,
    tenderId: p.tender.id,
    createdById: p.createdById,
    url: `${APP_URL}/tenders/${p.tender.id}/proposals/${proposalId}`,
  };
}

/** Send the same event to many recipients, each with their own rendered payload. */
async function fanOut(
  orgId: string,
  event: NotificationEvent,
  recipients: Recipient[],
  build: (r: Recipient) => { subject: string; react: React.ReactElement }
): Promise<void> {
  for (const r of recipients) {
    const { subject, react } = build(r);
    await sendEmail({
      orgId,
      memberId: r.memberId,
      to: r.email,
      event,
      category: categoryFor(event),
      subject,
      react,
    });
  }
}
