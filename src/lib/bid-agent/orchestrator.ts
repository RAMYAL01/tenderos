/**
 * Autonomous Bid Agent — the Orchestrator (Wave 3, #6).
 *
 * A persisted, resumable state machine that chains the siloed AI steps into an
 * overnight first-draft for one tender:
 *
 *   QUEUED --extract--> EXTRACTED --compliance--> COMPLIANCE_READY --qualify--> COMPLETED
 *
 * Same serverless contract as the BoqWorkflow orchestrator: `advance()` runs
 * EXACTLY ONE step and commits, so a run survives a timeout/crash and resumes from
 * the persisted state. The in-flight *_ING states re-run idempotently — and because
 * these steps MUTATE tenant tables (unlike the pure BoqWorkflow steps), each one
 * GUARDS against duplicating work:
 *   - extraction skips if the tender already has requirements (manual or a prior run),
 *   - compliance skips if rows are already mapped (it only fills templates via updateMany),
 *   - qualification upserts the BidDecision (idempotent by construction).
 *
 * Every query is org-scoped — a workflow can only ever be advanced by its owning
 * tenant. Each AI step consumes one AI credit, matching the manual flow.
 */

import type { AIJobType, BidWorkflowStatus, ContentLanguage, Prisma, SectionType } from "@prisma/client";
import { db } from "@/lib/prisma";
import { checkAndConsumeAiCredit, checkAndConsumeProposalQuota } from "@/lib/billing/quota";
import { activeModelId } from "@/lib/ai/llm-provider";
import { runExtractionAgent } from "@/lib/ai/agents/extract-requirements";
import { runComplianceAgent } from "@/lib/ai/agents/generate-compliance";
import { runBidQualifierAgent } from "@/lib/ai/agents/bid-qualifier";
import { generateSectionDraft } from "@/lib/ai/agents/draft-section";

const TERMINAL: BidWorkflowStatus[] = ["COMPLETED", "FAILED"];
const MAX_ATTEMPTS_PER_STEP = 3;

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface CreateBidWorkflowInput {
  orgId: string;
  tenderId: string;
  createdById?: string | null;
}

/** Create a bid-agent run in QUEUED for a tender. Tenant-scoped by orgId. */
export async function createBidWorkflow(args: CreateBidWorkflowInput): Promise<string> {
  if (!args.orgId || !args.tenderId) throw new Error("createBidWorkflow: orgId and tenderId required");
  const wf = await db.bidWorkflow.create({
    data: {
      orgId: args.orgId,
      tenderId: args.tenderId,
      createdById: args.createdById ?? null,
      status: "QUEUED",
    },
    select: { id: true },
  });
  return wf.id;
}

/**
 * Run exactly one transition for the workflow and persist it. Returns the new
 * status. Safe to call repeatedly (in-request driver or cron). Tenant-scoped.
 */
export async function advanceBidWorkflow(orgId: string, workflowId: string): Promise<BidWorkflowStatus> {
  if (!orgId || !workflowId) throw new Error("advance: orgId and workflowId required");

  const wf = await db.bidWorkflow.findFirst({ where: { id: workflowId, orgId } });
  if (!wf) throw new Error("advance: bid workflow not found for this tenant");
  if (TERMINAL.includes(wf.status)) return wf.status;

  if (wf.attempts >= MAX_ATTEMPTS_PER_STEP) {
    return fail(workflowId, wf.status, `Exceeded ${MAX_ATTEMPTS_PER_STEP} attempts on ${wf.status}.`);
  }

  try {
    switch (wf.status) {
      // ── Step 1: extract requirements (DRAFT/QUEUED, or resume EXTRACTING) ──
      case "QUEUED":
      case "EXTRACTING": {
        await mark(workflowId, "EXTRACTING");
        await stepExtract(orgId, wf.tenderId, wf.createdById);
        await db.bidWorkflow.update({
          where: { id: workflowId },
          data: { status: "EXTRACTED", attempts: 0, error: null, failedStep: null },
        });
        return "EXTRACTED";
      }

      // ── Step 2: generate compliance matrix (or resume CHECKING_COMPLIANCE) ──
      case "EXTRACTED":
      case "CHECKING_COMPLIANCE": {
        await mark(workflowId, "CHECKING_COMPLIANCE");
        await stepCompliance(orgId, wf.tenderId, wf.createdById);
        await db.bidWorkflow.update({
          where: { id: workflowId },
          data: { status: "COMPLIANCE_READY", attempts: 0 },
        });
        return "COMPLIANCE_READY";
      }

      // ── Step 3: Bid/No-Bid qualification (or resume QUALIFYING) ──
      case "COMPLIANCE_READY":
      case "QUALIFYING": {
        await mark(workflowId, "QUALIFYING");
        await stepQualify(orgId, wf.tenderId, wf.createdById);
        await db.bidWorkflow.update({
          where: { id: workflowId },
          data: { status: "QUALIFIED", attempts: 0 },
        });
        return "QUALIFIED";
      }

      // ── Step 4: draft the proposal (or resume DRAFTING_PROPOSAL) ──
      case "QUALIFIED":
      case "DRAFTING_PROPOSAL": {
        await mark(workflowId, "DRAFTING_PROPOSAL");
        const proposal = await stepDraftProposal(orgId, wf.tenderId, wf.createdById, workflowId);
        const [requirements, complianceRows, decision] = await Promise.all([
          db.requirement.count({ where: { tenderId: wf.tenderId, orgId, deletedAt: null } }),
          db.complianceMatrixRow.count({ where: { tenderId: wf.tenderId, orgId } }),
          db.bidDecision.findUnique({ where: { tenderId: wf.tenderId }, select: { recommendation: true } }),
        ]);
        await db.bidWorkflow.update({
          where: { id: workflowId },
          data: {
            status: "COMPLETED",
            attempts: 0,
            completedAt: new Date(),
            result: toJson({
              requirements,
              complianceRows,
              recommendation: decision?.recommendation ?? null,
              proposalId: proposal.proposalId,
              draftedSections: proposal.draftedSections,
            }),
          },
        });
        return "COMPLETED";
      }

      default:
        return wf.status;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(workflowId, wf.status, message);
  }
}

/**
 * Drive the workflow to a terminal state, bounded by maxSteps so it cannot exceed
 * the host's execution budget. If it returns non-terminal, the cron backstop (or
 * the next trigger) resumes from the persisted state.
 */
export async function runBidWorkflowToCompletion(
  orgId: string,
  workflowId: string,
  opts: { maxSteps?: number } = {}
): Promise<BidWorkflowStatus> {
  const maxSteps = Math.max(1, Math.min(opts.maxSteps ?? 6, 12));
  let status: BidWorkflowStatus = "QUEUED";
  for (let i = 0; i < maxSteps; i++) {
    status = await advanceBidWorkflow(orgId, workflowId);
    if (TERMINAL.includes(status)) break;
  }
  return status;
}

// ── Steps ───────────────────────────────────────────────────────────────────

async function stepExtract(orgId: string, tenderId: string, createdById: string | null): Promise<void> {
  // Idempotent: never clobber requirements that already exist (manual or a prior run).
  const existing = await db.requirement.count({ where: { tenderId, orgId, deletedAt: null } });
  if (existing > 0) return;

  const docs = await db.document.findMany({
    where: { tenderId, orgId, processingStatus: "READY", deletedAt: null },
    select: { id: true },
  });
  if (docs.length === 0) {
    throw new Error("No processed documents to extract from — upload and process tender documents first.");
  }

  await consumeCreditOrThrow(orgId);
  const jobId = await createStepJob(orgId, createdById, "EXTRACT_REQUIREMENTS", tenderId);
  await runExtractionAgent(jobId, tenderId, docs.map((d) => d.id), orgId);
}

async function stepCompliance(orgId: string, tenderId: string, createdById: string | null): Promise<void> {
  // Extraction already created a row per requirement; the compliance agent only fills
  // templates (updateMany). Skip if any row is already mapped so a resume doesn't recharge.
  const mapped = await db.complianceMatrixRow.count({ where: { tenderId, orgId, responseEn: { not: null } } });
  if (mapped > 0) return;

  await consumeCreditOrThrow(orgId);
  const jobId = await createStepJob(orgId, createdById, "GENERATE_COMPLIANCE_MATRIX", tenderId);
  await runComplianceAgent(jobId, tenderId, orgId);
}

async function stepQualify(orgId: string, tenderId: string, createdById: string | null): Promise<void> {
  if (!createdById) throw new Error("Bid qualification requires the run's creator.");
  // Idempotent: the qualifier upserts on tenderId, so skip if a decision already exists
  // (avoids re-charging a credit on a resume or a re-run).
  const existing = await db.bidDecision.findUnique({ where: { tenderId }, select: { id: true } });
  if (existing) return;
  await consumeCreditOrThrow(orgId);
  const jobId = await createStepJob(orgId, createdById, "BID_QUALIFICATION", tenderId);
  await runBidQualifierAgent(jobId, tenderId, orgId, createdById);
}

/** The narrative sections worth an autonomous first draft; the rest stay as shells. */
const CORE_SECTIONS: SectionType[] = ["EXECUTIVE_SUMMARY", "TECHNICAL_APPROACH", "COMPANY_OVERVIEW"];

async function stepDraftProposal(
  orgId: string,
  tenderId: string,
  createdById: string | null,
  workflowId: string
): Promise<{ proposalId: string; draftedSections: number }> {
  if (!createdById) throw new Error("Proposal drafting requires the run's creator.");

  // Find or create the proposal — idempotent, never a second one for the tender.
  let proposal = await db.proposal.findFirst({
    where: { tenderId, orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, language: true },
  });
  if (!proposal) {
    const quota = await checkAndConsumeProposalQuota(orgId);
    if (!quota.ok) throw new Error(quota.error ?? "Proposal limit reached for this plan.");
    proposal = await createProposalShell(orgId, tenderId, createdById);
  }

  const lang = proposal.language;
  const isAr = lang === "AR" || lang === "AR_SA" || lang === "AR_AE" || lang === "AR_EG";

  const sections = await db.proposalSection.findMany({
    where: { proposalId: proposal.id, orgId, sectionType: { in: CORE_SECTIONS }, deletedAt: null },
    orderBy: { orderIndex: "asc" },
    select: { id: true, sectionType: true, contentEn: true, contentAr: true },
  });

  let drafted = 0;
  for (const s of sections) {
    // Idempotent: skip a section that already has content (manual or a prior run).
    const existing = isAr ? s.contentAr : s.contentEn;
    if (existing && existing.trim().length > 0) continue;

    // Meter each draft like the manual flow; out of credits → stop, leave the rest as shells.
    const credit = await checkAndConsumeAiCredit(orgId);
    if (!credit.ok) break;

    const text = await generateSectionDraft({
      sectionId: s.id,
      sectionType: s.sectionType,
      tenderId,
      orgId,
      language: lang,
      tone: "formal_government",
    });

    await db.proposalSection.update({
      where: { id: s.id },
      data: {
        ...(isAr ? { contentAr: text } : { contentEn: text }),
        isAiGenerated: true,
        contentSource: "AI_GENERATED",
        aiModelUsed: activeModelId(),
        lastEditedById: createdById,
      },
    });
    drafted += 1;

    // Each completed section is progress — reset the attempt counter so a long draft
    // (or a mid-loop resume) can't trip MAX_ATTEMPTS_PER_STEP.
    await db.bidWorkflow.update({ where: { id: workflowId }, data: { attempts: 0 } });
  }

  return { proposalId: proposal.id, draftedSections: drafted };
}

/** Create a DRAFT proposal with the standard section set (mirrors createProposal). */
async function createProposalShell(
  orgId: string,
  tenderId: string,
  createdById: string
): Promise<{ id: string; language: ContentLanguage }> {
  const tender = await db.tender.findFirst({
    where: { id: tenderId, orgId },
    select: { titleEn: true, titleAr: true },
  });
  const defaultSections: SectionType[] = [
    "COVER_LETTER",
    "EXECUTIVE_SUMMARY",
    "COMPANY_OVERVIEW",
    "TECHNICAL_APPROACH",
    "METHODOLOGY",
    "WORK_PLAN",
    "TEAM_QUALIFICATIONS",
    "PAST_PERFORMANCE",
  ];
  return db.proposal.create({
    data: {
      tenderId,
      orgId,
      title: `Proposal — ${tender?.titleEn ?? tender?.titleAr ?? "Tender"}`.slice(0, 300),
      language: "EN",
      status: "DRAFT",
      createdById,
      sections: { create: defaultSections.map((sectionType, idx) => ({ orgId, sectionType, orderIndex: idx })) },
    },
    select: { id: true, language: true },
  });
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function consumeCreditOrThrow(orgId: string): Promise<void> {
  const quota = await checkAndConsumeAiCredit(orgId);
  if (!quota.ok) throw new Error(quota.error ?? "Out of AI credits for this billing period.");
}

async function createStepJob(
  orgId: string,
  memberId: string | null,
  jobType: AIJobType,
  tenderId: string
): Promise<string> {
  const job = await db.aIJob.create({
    data: {
      orgId,
      memberId: memberId ?? null,
      jobType,
      resourceType: "tender",
      resourceId: tenderId,
      status: "QUEUED",
      progress: 0,
      inputMetadata: { tenderId, viaBidAgent: true },
    },
    select: { id: true },
  });
  return job.id;
}

/** Mark a step in-flight and count the attempt (for resume + retry capping). */
async function mark(workflowId: string, status: BidWorkflowStatus): Promise<void> {
  await db.bidWorkflow.update({
    where: { id: workflowId },
    data: { status, attempts: { increment: 1 } },
  });
}

async function fail(workflowId: string, step: BidWorkflowStatus, message: string): Promise<BidWorkflowStatus> {
  await db.bidWorkflow.update({
    where: { id: workflowId },
    data: { status: "FAILED", error: message.slice(0, 1000), failedStep: step },
  });
  return "FAILED";
}
