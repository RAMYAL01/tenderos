import { db } from "@/lib/prisma";

/** A saved discovery monitor, serializable for the client island. */
export interface SavedSearchItem {
  id: string;
  name: string;
  filters: { query?: string; filter?: string };
  alertsEnabled: boolean;
  createdAt: string;
}

/** Org-scoped list of live saved searches (pure read). */
export async function getSavedSearches(orgId: string): Promise<SavedSearchItem[]> {
  const rows = await db.savedSearch.findMany({
    where: { orgId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, name: true, filters: true, alertsEnabled: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    filters: (r.filters as { query?: string; filter?: string }) ?? {},
    alertsEnabled: r.alertsEnabled,
    createdAt: r.createdAt.toISOString(),
  }));
}
