"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/security/audit";
import { notifyApprovalRequested, notifyApprovalCompleted } from "@/lib/email/events";
import { track, analyticsContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { ProposalReviewAction, ProposalStatus } from "@prisma/client";

/**
 * Proposal review gates — the approval state machine.
 *
 *   DRAFT / CHANGES_REQUESTED --submit (WRITER+)--> IN_REVIEW
 *   IN_REVIEW --approve (MANAGER+)-->               APPROVED
 *   IN_REVIEW --request changes (MANAGER+, note)--> CHANGES_REQUESTED
 *   APPROVED  --reopen (MANAGER+)-->                DRAFT
 *
 * Every transition is an ATOMIC conditional updateMany (org-scoped, status
 * predicate in the WHERE) so two racing clicks can't double-fire, and every
 * transition appends a ProposalReviewEvent — the approval trail.
 *
 * Writers cannot approve their own work: APPROVED is reachable only through
 * the MANAGER+ gate. (The legacy PATCH route no longer accepts review states.)
 */

type Result = { success: boolean; error?: string };

function isRedirect(e: unknown): boolean {
  return e instanceof Error && (e as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT") === true;
}

const IdSchema = z.string().min(1);
const NoteSchema = z.string().max(2000);

/** Shared transition core: guard → flip → trail, in one transaction. */
async function transition(opts: {
  proposalId: string;
  orgId: string;
  actorId: string;
  from: ProposalStatus[];
  to: ProposalStatus;
  action: ProposalReviewAction;
  note?: string | null;
  failMessage: string;
}): Promise<Result> {
  const { proposalId, orgId, actorId, from, to, action, note, failMessage } = opts;

  const ok = await db.$transaction(async (tx) => {
    const res = await tx.proposal.updateMany({
      where: { id: proposalId, orgId, deletedAt: null, status: { in: from } },
      data: { status: to },
    });
    if (res.count === 0) return false;

    await tx.proposalReviewEvent.create({
      data: { orgId, proposalId, action, note: note ?? null, actorId },
    });
    return true;
  });

  if (!ok) return { success: false, error: failMessage };

  // Org-level security audit (one call covers all four gates).
  await logAudit({
    orgId,
    memberId: actorId,
    action: `proposal.${action.toLowerCase()}`,
    resourceType: "proposal",
    resourceId: proposalId,
    newValues: { status: to, note: note ?? null },
  });

  revalidatePath(`/tenders`);
  revalidatePath(`/proposals`);
  return { success: true };
}

/** Writer submits the proposal for management review. */
export async function submitProposalForReview(proposalId: string): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");
    const id = IdSchema.parse(proposalId);

    const result = await transition({
      proposalId: id,
      orgId: org.id,
      actorId: member.id,
      from: ["DRAFT", "CHANGES_REQUESTED"],
      to: "IN_REVIEW",
      action: "SUBMITTED",
      failMessage: "Only a draft (or changes-requested) proposal can be submitted for review.",
    });
    if (result.success) {
      after(() =>
        notifyApprovalRequested({ orgId: org.id, proposalId: id, requestorMemberId: member.id })
      );
    }
    return result;
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("submitProposalForReview error:", err);
    return { success: false, error: "Could not submit for review." };
  }
}

/** Manager approves a proposal under review. */
export async function approveProposal(proposalId: string, note?: string): Promise<Result> {
  try {
    const { clerkUserId, org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");
    const id = IdSchema.parse(proposalId);

    const result = await transition({
      proposalId: id,
      orgId: org.id,
      actorId: member.id,
      from: ["IN_REVIEW"],
      to: "APPROVED",
      action: "APPROVED",
      note: note ? NoteSchema.parse(note) : null,
      failMessage: "Only a proposal in review can be approved.",
    });
    if (result.success) {
      after(() =>
        notifyApprovalCompleted({ orgId: org.id, proposalId: id, approverMemberId: member.id })
      );
      after(() =>
        track(ANALYTICS_EVENTS.PROPOSAL_APPROVED, analyticsContext({ clerkUserId, org, member }), {
          tenderId: undefined,
        })
      );
    }
    return result;
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("approveProposal error:", err);
    return { success: false, error: "Could not approve the proposal." };
  }
}

/** Manager sends a proposal back with required feedback. */
export async function requestProposalChanges(proposalId: string, note: string): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");
    const id = IdSchema.parse(proposalId);

    const trimmed = (note ?? "").trim();
    if (trimmed.length < 3) {
      return { success: false, error: "Tell the writer what needs to change." };
    }

    return await transition({
      proposalId: id,
      orgId: org.id,
      actorId: member.id,
      from: ["IN_REVIEW"],
      to: "CHANGES_REQUESTED",
      action: "CHANGES_REQUESTED",
      note: NoteSchema.parse(trimmed),
      failMessage: "Only a proposal in review can be sent back.",
    });
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("requestProposalChanges error:", err);
    return { success: false, error: "Could not request changes." };
  }
}

/** Manager reopens an approved proposal for further editing. */
export async function reopenProposal(proposalId: string): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");
    const id = IdSchema.parse(proposalId);

    return await transition({
      proposalId: id,
      orgId: org.id,
      actorId: member.id,
      from: ["APPROVED"],
      to: "DRAFT",
      action: "REOPENED",
      failMessage: "Only an approved proposal can be reopened.",
    });
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("reopenProposal error:", err);
    return { success: false, error: "Could not reopen the proposal." };
  }
}
