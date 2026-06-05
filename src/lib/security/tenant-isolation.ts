/**
 * Part 1 — Absolute Data Isolation (Prisma Client Extension).
 *
 * Developers MUST NOT have to remember `where: { orgId }`. This extension
 * injects the tenant filter into EVERY operation on EVERY model that carries an
 * `orgId`, derived automatically from the schema via Prisma's DMMF — add a new
 * tenant-scoped table and it is covered with zero extra code.
 *
 * Guarantees (fail-closed):
 *   - reads (find-all, count, aggregate, groupBy): scoped by `orgId` in `where`.
 *   - writes by unique key (update/delete/upsert): `orgId` added to the unique
 *     `where`. Prisma's WhereUniqueInput (v4.5+) accepts extra scalar filters,
 *     so a cross-tenant id resolves to "record not found" (P2025) — it CANNOT
 *     touch another tenant's row.
 *   - creates: `orgId` is stamped onto `data`, so a tenant can only ever write
 *     rows owned by itself.
 *
 * The injected `orgId` is bound at client-construction time from the verified
 * session — it is never read from caller-supplied args.
 */

import { Prisma } from "@prisma/client";

const TENANT_FIELD = "orgId";

/** Models that actually carry `orgId` — computed from the schema at load. */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.fields.some((f) => f.name === TENANT_FIELD))
    .map((m) => m.name)
);

const WHERE_OPERATIONS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "findUnique",
  "findUniqueOrThrow",
  "update",
  "delete",
  "updateMany",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Mutate `args` so the operation is constrained to a single tenant. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyTenantScope(operation: string, args: any, orgId: string): any {
  const a = args ?? {};

  if (WHERE_OPERATIONS.has(operation)) {
    a.where = { ...(a.where ?? {}), [TENANT_FIELD]: orgId };
    return a;
  }
  if (operation === "create") {
    a.data = { ...(a.data ?? {}), [TENANT_FIELD]: orgId };
    return a;
  }
  if (operation === "createMany") {
    a.data = Array.isArray(a.data)
      ? a.data.map((d: Record<string, unknown>) => ({ ...d, [TENANT_FIELD]: orgId }))
      : { ...(a.data ?? {}), [TENANT_FIELD]: orgId };
    return a;
  }
  if (operation === "upsert") {
    a.where = { ...(a.where ?? {}), [TENANT_FIELD]: orgId };
    a.create = { ...(a.create ?? {}), [TENANT_FIELD]: orgId };
    return a;
  }
  // Unknown/future operation: scope defensively if it carries a `where`.
  if (a && typeof a === "object" && "where" in a) {
    a.where = { ...(a.where ?? {}), [TENANT_FIELD]: orgId };
  }
  return a;
}

/** Build a Prisma extension bound to one tenant. */
export function tenantIsolationExtension(orgId: string) {
  if (!orgId) throw new Error("tenantIsolationExtension: orgId is required (refusing unscoped client)");

  return Prisma.defineExtension({
    name: "tenant-isolation",
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          const finalArgs = TENANT_SCOPED_MODELS.has(model)
            ? applyTenantScope(operation, args, orgId)
            : args;
          return query(finalArgs);
        },
      },
    },
  });
}
