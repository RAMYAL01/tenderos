"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/security/audit";
import { areConnected } from "@/lib/data/marketplace";
import { track, analyticsContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Marketplace actions — the partner / JV network's writes.
 *
 * Role split mirrors the rest of the app:
 *   • Profile + publish (the company's public face) → ADMIN+ (a settings-level
 *     act, like the audit log and member management).
 *   • Connection request / response (business development) → MANAGER+.
 *
 * Every write is org-scoped in its predicate (never trust an id alone), and the
 * connection response is addressee-scoped and status-guarded for race-safety.
 */

type Result = { success: boolean; error?: string };

const rethrowRedirect = (err: unknown) => {
  if (err instanceof Error && (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw err;
};

// ── Profile ───────────────────────────────────────────────────────────────────

const ProfileSchema = z.object({
  displayName: z.string().trim().min(2, "A display name is required.").max(120),
  displayNameAr: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().length(2).toUpperCase().optional().nullable(),
  sectors: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  capabilities: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  employeeBand: z.string().trim().max(20).optional().nullable(),
  blurb: z.string().trim().max(2000).optional().nullable(),
  website: z.string().trim().url("Website must be a valid URL.").max(200).optional().or(z.literal("")).nullable(),
  contactName: z.string().trim().max(120).optional().nullable(),
  contactEmail: z.string().trim().email("Contact email must be valid.").max(200).optional().or(z.literal("")).nullable(),
});

/** Create or update the org's directory profile (ADMIN+). Does not change `published`. */
export async function upsertMarketplaceProfile(input: z.infer<typeof ProfileSchema>): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

    const parsed = ProfileSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const d = parsed.data;

    const data = {
      displayName: d.displayName,
      displayNameAr: d.displayNameAr || null,
      country: d.country || null,
      sectors: d.sectors,
      capabilities: d.capabilities,
      employeeBand: d.employeeBand || null,
      blurb: d.blurb || null,
      website: d.website || null,
      contactName: d.contactName || null,
      contactEmail: d.contactEmail || null,
    };

    const existing = await db.marketplaceProfile.findFirst({ where: { orgId: org.id }, select: { id: true } });
    if (existing) {
      // Org-scoped write (orgId in the predicate).
      await db.marketplaceProfile.updateMany({ where: { id: existing.id, orgId: org.id }, data });
    } else {
      await db.marketplaceProfile.create({ data: { ...data, orgId: org.id, createdById: member.id } });
    }

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: "marketplace.profile_updated",
      resourceType: "marketplace_profile",
      resourceId: org.id,
      newValues: { displayName: data.displayName, country: data.country, created: !existing },
    });

    revalidatePath("/marketplace/profile");
    revalidatePath("/marketplace");
    return { success: true };
  } catch (err) {
    rethrowRedirect(err);
    console.error("upsertMarketplaceProfile error:", err);
    return { success: false, error: "Could not save the profile." };
  }
}

/** Publish / unpublish the org's profile in the directory (ADMIN+). */
export async function setMarketplacePublished(published: boolean): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

    const profile = await db.marketplaceProfile.findFirst({
      where: { orgId: org.id, deletedAt: null },
      select: { id: true, displayName: true },
    });
    if (!profile) return { success: false, error: "Create your profile before publishing." };
    if (published && profile.displayName.trim().length < 2) {
      return { success: false, error: "Add a display name before publishing." };
    }

    await db.marketplaceProfile.updateMany({ where: { id: profile.id, orgId: org.id }, data: { published } });

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: published ? "marketplace.published" : "marketplace.unpublished",
      resourceType: "marketplace_profile",
      resourceId: org.id,
    });

    revalidatePath("/marketplace/profile");
    revalidatePath("/marketplace");
    return { success: true };
  } catch (err) {
    rethrowRedirect(err);
    console.error("setMarketplacePublished error:", err);
    return { success: false, error: "Could not update publish status." };
  }
}

// ── Connections ─────────────────────────────────────────────────────────────

const RequestSchema = z.object({
  addresseeOrgId: z.string().min(1),
  message: z.string().trim().max(1000).optional().nullable(),
});

/**
 * Send a connection request to another published org (MANAGER+).
 *
 * Anti-harvesting: the requester must ALSO have a published profile — to reach
 * into the network you must be visible in it. Self-requests are rejected; an
 * existing ACCEPTED connection short-circuits; a prior DECLINED request in this
 * direction can be re-opened; an incoming pending request is surfaced (accept it
 * instead of creating a mirror row).
 */
export async function requestConnection(input: z.infer<typeof RequestSchema>): Promise<Result> {
  try {
    const { clerkUserId, org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");

    const parsed = RequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const { addresseeOrgId, message } = parsed.data;

    if (addresseeOrgId === org.id) return { success: false, error: "You can't connect to your own org." };

    // Requester must be visible in the network (anti-harvesting).
    const mine = await db.marketplaceProfile.findFirst({
      where: { orgId: org.id, published: true, deletedAt: null },
      select: { id: true },
    });
    if (!mine) return { success: false, error: "Publish your own profile before requesting connections." };

    // Addressee must have a published profile.
    const target = await db.marketplaceProfile.findFirst({
      where: { orgId: addresseeOrgId, published: true, deletedAt: null },
      select: { id: true },
    });
    if (!target) return { success: false, error: "That org isn't available in the directory." };

    // Already connected (either direction)? Done.
    if (await areConnected(org.id, addresseeOrgId)) return { success: false, error: "You're already connected." };

    // They've already requested YOU → tell the user to accept, don't mirror.
    const incoming = await db.partnerConnection.findFirst({
      where: { requesterOrgId: addresseeOrgId, addresseeOrgId: org.id, status: "PENDING" },
      select: { id: true },
    });
    if (incoming) return { success: false, error: "This org has already requested you — accept their request instead." };

    // Upsert this direction: new PENDING, or re-open a DECLINED one.
    await db.partnerConnection.upsert({
      where: { requesterOrgId_addresseeOrgId: { requesterOrgId: org.id, addresseeOrgId } },
      create: {
        requesterOrgId: org.id,
        addresseeOrgId,
        status: "PENDING",
        message: message || null,
        requestedById: member.id,
      },
      update: { status: "PENDING", message: message || null, requestedById: member.id, respondedById: null, respondedAt: null },
    });

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: "marketplace.connection_requested",
      resourceType: "partner_connection",
      resourceId: addresseeOrgId,
    });

    after(() =>
      track(
        ANALYTICS_EVENTS.MARKETPLACE_CONNECTION_REQUESTED,
        analyticsContext({ clerkUserId, org, member })
      )
    );

    revalidatePath("/marketplace");
    revalidatePath("/marketplace/connections");
    return { success: true };
  } catch (err) {
    rethrowRedirect(err);
    console.error("requestConnection error:", err);
    return { success: false, error: "Could not send the request." };
  }
}

const RespondSchema = z.object({
  connectionId: z.string().min(1),
  accept: z.boolean(),
  responseMessage: z.string().trim().max(1000).optional().nullable(),
});

/** Accept or decline an INCOMING connection request (MANAGER+, addressee-scoped). */
export async function respondToConnection(input: z.infer<typeof RespondSchema>): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "MANAGER");

    const parsed = RespondSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    const { connectionId, accept, responseMessage } = parsed.data;

    // Race-safe, addressee-scoped, status-guarded: only the addressee org can
    // act, and only on a still-PENDING request.
    const res = await db.partnerConnection.updateMany({
      where: { id: connectionId, addresseeOrgId: org.id, status: "PENDING" },
      data: {
        status: accept ? "ACCEPTED" : "DECLINED",
        responseMessage: responseMessage || null,
        respondedById: member.id,
        respondedAt: new Date(),
      },
    });
    if (res.count === 0) return { success: false, error: "Request not found or already handled." };

    await logAudit({
      orgId: org.id,
      memberId: member.id,
      action: accept ? "marketplace.connection_accepted" : "marketplace.connection_declined",
      resourceType: "partner_connection",
      resourceId: connectionId,
    });

    revalidatePath("/marketplace");
    revalidatePath("/marketplace/connections");
    return { success: true };
  } catch (err) {
    rethrowRedirect(err);
    console.error("respondToConnection error:", err);
    return { success: false, error: "Could not respond to the request." };
  }
}
