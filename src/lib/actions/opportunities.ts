"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import {
  checkSavedSearchLimit,
  checkTrackedOpportunityLimit,
  canUseScheduledDiscovery,
} from "@/lib/billing/quota";
import { matchOpportunitiesForOrg } from "@/lib/discovery/match";

/**
 * Discovery server actions. Every action resolves orgId from getAuthContext()
 * and scopes all writes to it. The catalog (Opportunity/OpportunitySource) is
 * NEVER written here — only ingest.ts may.
 */

type Result<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : T))
  | { success: false; error: string };

function isRedirectError(e: unknown): boolean {
  return e instanceof Error && (e as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT") === true;
}

// ── Scan (bounded match trigger — NEVER on page render, M8) ────────────────────

/** Compute/refresh this org's matched feed. User- or onboarding-initiated. */
export async function scanForOpportunities(): Promise<Result<{ matched: number }>> {
  try {
    const { org } = await getAuthContext();
    const res = await matchOpportunitiesForOrg(org.id);
    revalidatePath("/discover");
    return { success: true, matched: res.matched };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("scanForOpportunities error:", err);
    return { success: false, error: "Could not scan for opportunities." };
  }
}

// ── Track (save) — counts against maxTrackedOpportunities (M4/M6) ──────────────

export async function trackOpportunity(opportunityId: string): Promise<Result> {
  try {
    const { org } = await getAuthContext();

    const existing = await db.opportunityMatch.findUnique({
      where: { orgId_opportunityId: { orgId: org.id, opportunityId } },
      select: { id: true, trackingStatus: true, relevanceScore: true },
    });

    // Only consumes a tracked slot when transitioning INTO a tracked state.
    const alreadyTracked =
      existing?.trackingStatus === "SAVED" || existing?.trackingStatus === "CONVERTED";
    if (!alreadyTracked) {
      const quota = await checkTrackedOpportunityLimit(org.id);
      if (!quota.ok) return { success: false, error: quota.error };
    }

    if (existing) {
      await db.opportunityMatch.updateMany({
        where: { id: existing.id, orgId: org.id },
        data: { trackingStatus: "SAVED" },
      });
    } else {
      // Tracking an opportunity not in the matched feed — verify it exists, then
      // create a SAVED match with a neutral score (it wasn't system-scored).
      const opp = await db.opportunity.findUnique({ where: { id: opportunityId }, select: { id: true } });
      if (!opp) return { success: false, error: "Opportunity not found." };
      await db.opportunityMatch.create({
        data: { orgId: org.id, opportunityId, relevanceScore: 0.5, trackingStatus: "SAVED" },
      });
    }

    revalidatePath("/discover");
    return { success: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("trackOpportunity error:", err);
    return { success: false, error: "Could not track the opportunity." };
  }
}

export async function dismissOpportunity(matchId: string, reason?: string): Promise<Result> {
  try {
    const { org } = await getAuthContext();
    const res = await db.opportunityMatch.updateMany({
      where: { id: matchId, orgId: org.id },
      data: { trackingStatus: "DISMISSED", dismissedReason: reason?.slice(0, 200) ?? null },
    });
    if (res.count === 0) return { success: false, error: "Not found." };
    revalidatePath("/discover");
    return { success: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("dismissOpportunity error:", err);
    return { success: false, error: "Could not dismiss." };
  }
}

// ── Saved search (quota M4 + tier gate on alerts) ──────────────────────────────

const SavedSearchSchema = z.object({
  name: z.string().min(2, "Name your search").max(80),
  filters: z.record(z.string(), z.unknown()).optional(),
  alertsEnabled: z.boolean().optional(),
});

export async function createSavedSearch(
  input: z.infer<typeof SavedSearchSchema>
): Promise<Result<{ id: string }>> {
  try {
    const { org, member } = await getAuthContext();

    const parsed = SavedSearchSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const quota = await checkSavedSearchLimit(org.id);
    if (!quota.ok) return { success: false, error: quota.error };

    // Scheduled alerts are a paid-tier feature.
    const alertsEnabled = parsed.data.alertsEnabled === true && canUseScheduledDiscovery(org.planTier);

    const row = await db.savedSearch.create({
      data: {
        orgId: org.id,
        name: parsed.data.name,
        filters: parsed.data.filters ? JSON.parse(JSON.stringify(parsed.data.filters)) : {},
        alertsEnabled,
        createdById: member.id,
      },
      select: { id: true },
    });

    revalidatePath("/discover");
    return { success: true, id: row.id };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("createSavedSearch error:", err);
    return { success: false, error: "Could not save the search." };
  }
}

/** Soft-delete a saved search (org-scoped; alert history is kept via SetNull). */
export async function deleteSavedSearch(id: string): Promise<Result> {
  try {
    const { org } = await getAuthContext();
    const res = await db.savedSearch.updateMany({
      where: { id, orgId: org.id, deletedAt: null },
      data: { deletedAt: new Date(), alertsEnabled: false },
    });
    if (res.count === 0) return { success: false, error: "Not found." };
    revalidatePath("/discover");
    return { success: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("deleteSavedSearch error:", err);
    return { success: false, error: "Could not delete the search." };
  }
}

/** Toggle daily-digest alerts on a saved search (paid tiers only). */
export async function toggleSavedSearchAlerts(id: string, enabled: boolean): Promise<Result> {
  try {
    const { org } = await getAuthContext();
    if (enabled && !canUseScheduledDiscovery(org.planTier)) {
      return {
        success: false,
        error: "Daily discovery alerts are available on Professional and above. Upgrade in Settings → Billing.",
      };
    }
    const res = await db.savedSearch.updateMany({
      where: { id, orgId: org.id, deletedAt: null },
      data: { alertsEnabled: enabled },
    });
    if (res.count === 0) return { success: false, error: "Not found." };
    revalidatePath("/discover");
    return { success: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("toggleSavedSearchAlerts error:", err);
    return { success: false, error: "Could not update alerts." };
  }
}

// ── Convert → Tender (WRITER M12 · atomic M13 · same-org txn M2 · normalize M15) ─

const TENDER_TYPES = new Set(["RFP", "RFQ", "ITB", "EOI", "ITT", "RFI"]);

/** Normalize a free-text source tenderType to the Tender enum, else null (M15). */
function normalizeTenderType(raw: string | null): string | null {
  if (!raw) return null;
  const up = raw.trim().toUpperCase();
  if (TENDER_TYPES.has(up)) return up;
  if (/PROPOSAL/.test(up)) return "RFP";
  if (/QUOT/.test(up)) return "RFQ";
  if (/INVITATION TO BID|^BID/.test(up)) return "ITB";
  if (/EXPRESSION/.test(up)) return "EOI";
  if (/INVITATION TO TENDER|^TENDER/.test(up)) return "ITT";
  if (/INFORMATION/.test(up)) return "RFI";
  return null;
}

export async function convertOpportunityToTender(
  matchId: string
): Promise<Result<{ tenderId: string; alreadyConverted: boolean }>> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER"); // M12: same gate as createTender

    // Load the org's match + the (global, read-only) opportunity it points at.
    const match = await db.opportunityMatch.findFirst({
      where: { id: matchId, orgId: org.id },
      include: { opportunity: true },
    });
    if (!match) return { success: false, error: "Opportunity not found." };

    // Already converted → return the existing tender (idempotent).
    if (match.trackingStatus === "CONVERTED" && match.convertedTenderId) {
      return { success: true, tenderId: match.convertedTenderId, alreadyConverted: true };
    }

    // M6: converting into a tracked state consumes a slot (unless already tracked).
    if (match.trackingStatus !== "SAVED") {
      const quota = await checkTrackedOpportunityLimit(org.id);
      if (!quota.ok) return { success: false, error: quota.error };
    }

    const o = match.opportunity;
    const titleEn = o.titleEn?.trim() || "Untitled tender";
    const clientCountry = o.country && o.country.length === 2 ? o.country.toUpperCase() : null;
    const currency = o.currency && o.currency.length === 3 ? o.currency.toUpperCase() : "USD";

    // M2/M13: atomic claim + create + stamp, all in ONE transaction, all org-scoped.
    const result = await db.$transaction(async (tx) => {
      // Atomic dedup guard: only the first concurrent click flips NEW/SAVED→CONVERTED.
      const claim = await tx.opportunityMatch.updateMany({
        where: { id: matchId, orgId: org.id, trackingStatus: { not: "CONVERTED" } },
        data: { trackingStatus: "CONVERTED" },
      });
      if (claim.count === 0) {
        const e = await tx.opportunityMatch.findFirst({
          where: { id: matchId, orgId: org.id },
          select: { convertedTenderId: true },
        });
        return { tenderId: e?.convertedTenderId ?? null, alreadyConverted: true };
      }

      const tender = await tx.tender.create({
        data: {
          orgId: org.id, // same org as the match — never client-supplied
          titleEn: titleEn.slice(0, 300),
          titleAr: o.titleAr?.slice(0, 300) ?? null,
          referenceNo: o.referenceNo?.slice(0, 100) ?? null,
          clientName: o.buyerName?.slice(0, 200) ?? null,
          clientNameAr: o.buyerNameAr?.slice(0, 200) ?? null,
          clientCountry,
          sector: o.sector ?? null,
          tenderType: normalizeTenderType(o.tenderType),
          submissionDeadline: o.closingDate,
          estimatedValue: o.estimatedValue,
          currency,
          primaryLanguage: o.language,
          status: "DRAFT",
          notes: "Imported from Discovery.",
          sourceOpportunityId: o.id, // provenance
          createdById: member.id, // M14: Tender.createdById is required — user-initiated only
        },
        select: { id: true },
      });

      await tx.opportunityMatch.update({
        where: { id: matchId },
        data: { convertedTenderId: tender.id },
      });

      return { tenderId: tender.id, alreadyConverted: false };
    });

    if (!result.tenderId) return { success: false, error: "Could not create the tender." };

    revalidatePath("/discover");
    revalidatePath("/tenders");
    return { success: true, tenderId: result.tenderId, alreadyConverted: result.alreadyConverted };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("convertOpportunityToTender error:", err);
    return { success: false, error: "Could not convert the opportunity." };
  }
}
