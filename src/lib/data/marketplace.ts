import { db } from "@/lib/prisma";

/**
 * Marketplace read model — the partner / JV directory.
 *
 * THE BOUNDARY LIVES HERE. The marketplace is a deliberate cross-tenant surface
 * (the mirror of the global Discovery catalog), so this layer is the one place
 * that reads OTHER orgs' rows. Two invariants it must never break:
 *
 *   1. Only `published && !deletedAt` profiles are ever visible to another org.
 *   2. A profile's private payload (contactName, contactEmail) is revealed to a
 *      viewer ONLY when an ACCEPTED PartnerConnection exists between the two orgs
 *      (in either direction). `DirectoryCard` has NO contact fields at all — it
 *      is structurally impossible to leak them through the browse view. Contact
 *      info is surfaced in exactly ONE place — the connections inbox
 *      (`getConnections`), and only for rows whose status is ACCEPTED.
 *
 * The viewer's own profile is excluded from the directory (you don't browse to
 * yourself) and is read in full via `getMyProfile` (it's your own data).
 */

export type ViewerConnection =
  | { state: "none" }
  | { state: "connected" }
  | { state: "incoming"; connectionId: string } // they requested me → I can accept
  | { state: "outgoing" } // I requested them → pending their response
  | { state: "declined" }; // a prior request was declined

/** Browse card — NO contact fields by construction. */
export interface DirectoryCard {
  orgId: string;
  displayName: string;
  displayNameAr: string | null;
  country: string | null;
  sectors: string[];
  capabilities: string[];
  employeeBand: string | null;
  blurb: string | null;
  website: string | null;
  connection: ViewerConnection;
}

/** The org's own profile (full — it's their own data). */
export interface OwnProfile {
  orgId: string;
  published: boolean;
  displayName: string;
  displayNameAr: string | null;
  country: string | null;
  sectors: string[];
  capabilities: string[];
  employeeBand: string | null;
  blurb: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  updatedAt: Date;
}

export interface DirectoryFilters {
  country?: string | null;
  sector?: string | null;
  q?: string | null;
}

const CARD_SELECT = {
  orgId: true,
  displayName: true,
  displayNameAr: true,
  country: true,
  sectors: true,
  capabilities: true,
  employeeBand: true,
  blurb: true,
  website: true,
} as const;

/**
 * Build a map: otherOrgId → the viewer's relationship to that org. One query
 * over every connection touching `orgId` in either direction. Priority when
 * both directions have rows: connected > incoming-pending > outgoing-pending >
 * declined (so an actionable incoming request always wins the CTA).
 */
async function buildConnectionMap(orgId: string): Promise<Map<string, ViewerConnection>> {
  const rows = await db.partnerConnection.findMany({
    where: { OR: [{ requesterOrgId: orgId }, { addresseeOrgId: orgId }] },
    select: { id: true, requesterOrgId: true, addresseeOrgId: true, status: true },
  });

  const map = new Map<string, ViewerConnection>();
  const rank = (c: ViewerConnection) =>
    c.state === "connected" ? 4 : c.state === "incoming" ? 3 : c.state === "outgoing" ? 2 : c.state === "declined" ? 1 : 0;

  for (const r of rows) {
    const other = r.requesterOrgId === orgId ? r.addresseeOrgId : r.requesterOrgId;
    const iAmAddressee = r.addresseeOrgId === orgId;

    let next: ViewerConnection;
    if (r.status === "ACCEPTED") next = { state: "connected" };
    else if (r.status === "PENDING") next = iAmAddressee ? { state: "incoming", connectionId: r.id } : { state: "outgoing" };
    else next = { state: "declined" };

    const prev = map.get(other);
    if (!prev || rank(next) > rank(prev)) map.set(other, next);
  }
  return map;
}

/** True iff an ACCEPTED connection exists between the two orgs (either direction). */
export async function areConnected(orgId: string, otherOrgId: string): Promise<boolean> {
  if (orgId === otherOrgId) return true; // your own profile
  const row = await db.partnerConnection.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterOrgId: orgId, addresseeOrgId: otherOrgId },
        { requesterOrgId: otherOrgId, addresseeOrgId: orgId },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}

/** The directory: published profiles other than the viewer's, with CTA state. */
export async function getDirectory(orgId: string, filters: DirectoryFilters = {}): Promise<DirectoryCard[]> {
  const q = filters.q?.trim();
  const profiles = await db.marketplaceProfile.findMany({
    where: {
      published: true,
      deletedAt: null,
      orgId: { not: orgId }, // never browse to yourself
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.sector ? { sectors: { has: filters.sector } } : {}),
      ...(q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { blurb: { contains: q, mode: "insensitive" } },
              { capabilities: { has: q } },
            ],
          }
        : {}),
    },
    select: CARD_SELECT,
    orderBy: { displayName: "asc" },
    take: 200,
  });

  const connMap = await buildConnectionMap(orgId);
  return profiles.map((p) => ({
    ...p,
    connection: connMap.get(p.orgId) ?? { state: "none" },
  }));
}

/** The viewer org's own profile, in full (or null if they haven't created one). */
export async function getMyProfile(orgId: string): Promise<OwnProfile | null> {
  const p = await db.marketplaceProfile.findFirst({
    where: { orgId, deletedAt: null },
    select: {
      orgId: true,
      published: true,
      displayName: true,
      displayNameAr: true,
      country: true,
      sectors: true,
      capabilities: true,
      employeeBand: true,
      blurb: true,
      website: true,
      contactName: true,
      contactEmail: true,
      updatedAt: true,
    },
  });
  return p;
}

export interface ConnectionRow {
  connectionId: string;
  direction: "incoming" | "outgoing";
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  otherOrgId: string;
  otherName: string;
  otherCountry: string | null;
  message: string | null;
  contactEmail: string | null; // revealed only when ACCEPTED
  createdAt: Date;
}

/**
 * The viewer's connections inbox: incoming requests to act on + outgoing/settled.
 * The other org's display fields come from its profile. contactEmail is included
 * ONLY for ACCEPTED rows (the same reveal rule as the directory detail view).
 */
export async function getConnections(orgId: string): Promise<ConnectionRow[]> {
  const rows = await db.partnerConnection.findMany({
    where: { OR: [{ requesterOrgId: orgId }, { addresseeOrgId: orgId }] },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      message: true,
      createdAt: true,
      requesterOrgId: true,
      addresseeOrgId: true,
    },
  });
  if (rows.length === 0) return [];

  // One batched read of the counterpart profiles (names/countries/emails).
  const otherIds = Array.from(new Set(rows.map((r) => (r.requesterOrgId === orgId ? r.addresseeOrgId : r.requesterOrgId))));
  const profiles = await db.marketplaceProfile.findMany({
    where: { orgId: { in: otherIds } },
    select: { orgId: true, displayName: true, country: true, contactEmail: true },
  });
  const byOrg = new Map(profiles.map((p) => [p.orgId, p]));

  return rows.map((r) => {
    const otherOrgId = r.requesterOrgId === orgId ? r.addresseeOrgId : r.requesterOrgId;
    const prof = byOrg.get(otherOrgId);
    const accepted = r.status === "ACCEPTED";
    return {
      connectionId: r.id,
      direction: r.addresseeOrgId === orgId ? "incoming" : "outgoing",
      status: r.status,
      otherOrgId,
      otherName: prof?.displayName ?? "A partner org",
      otherCountry: prof?.country ?? null,
      message: r.message,
      contactEmail: accepted ? prof?.contactEmail ?? null : null,
      createdAt: r.createdAt,
    };
  });
}
