/**
 * API keys for ERP → TenderOS ingestion (Part 2 auth).
 *
 * The raw key is shown to the client ONCE at creation; we persist only its
 * SHA-256 hash, so a DB leak never exposes a usable credential. Every key is
 * bound to exactly one tenant (orgId) — authenticating a request yields the
 * tenant, which then scopes all writes.
 */

import crypto from "node:crypto";
import { db } from "@/lib/prisma";

const PREFIX = "tk_live_";

export interface ApiKeyContext {
  orgId: string;
  apiKeyId: string;
  scopes: string[];
}

export class ApiAuthError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
    this.name = "ApiAuthError";
  }
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Create a new key. Returns the RAW key (show once) + the stored id. */
export async function createApiKey(
  orgId: string,
  name: string,
  scopes: string[] = ["erp:write"],
  createdById?: string
): Promise<{ id: string; rawKey: string; prefix: string }> {
  const rawKey = PREFIX + crypto.randomBytes(24).toString("base64url");
  const prefix = rawKey.slice(0, 12);
  const created = await db.apiKey.create({
    data: { orgId, name, prefix, hashedKey: sha256(rawKey), scopes, createdById: createdById ?? null },
    select: { id: true },
  });
  return { id: created.id, rawKey, prefix };
}

/** Verify a raw key. Returns the tenant context or null (does not throw). */
export async function verifyApiKey(rawKey: string): Promise<ApiKeyContext | null> {
  if (!rawKey || !rawKey.startsWith(PREFIX)) return null;

  const record = await db.apiKey.findUnique({
    where: { hashedKey: sha256(rawKey) },
    select: { id: true, orgId: true, scopes: true, revokedAt: true, expiresAt: true },
  });
  if (!record || record.revokedAt) return null;
  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) return null;

  // best-effort usage stamp — never block the request on it
  void db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { orgId: record.orgId, apiKeyId: record.id, scopes: record.scopes };
}

/** Extract + verify the API key from a request. Throws ApiAuthError on failure. */
export async function authenticateErpRequest(req: Request, requiredScope?: string): Promise<ApiKeyContext> {
  const header = req.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : undefined;
  const rawKey = bearer ?? req.headers.get("x-api-key")?.trim();

  if (!rawKey) throw new ApiAuthError("Missing API key (Authorization: Bearer <key> or X-API-Key).");

  const ctx = await verifyApiKey(rawKey);
  if (!ctx) throw new ApiAuthError("Invalid or revoked API key.");
  if (requiredScope && !ctx.scopes.includes(requiredScope)) {
    throw new ApiAuthError(`API key lacks required scope "${requiredScope}".`, 403);
  }
  return ctx;
}
