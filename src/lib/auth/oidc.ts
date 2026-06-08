/**
 * On-prem OIDC auth adapter (replaces Clerk for the Enterprise edition).
 *
 * Activated by AUTH_PROVIDER=oidc. Federates any OIDC IdP — Keycloak (which can
 * itself federate Azure AD / ADFS). Flow:
 *   /api/auth/oidc/login    -> redirect to the IdP authorize endpoint
 *   /api/auth/oidc/callback -> code exchange, verify id_token (JWKS), issue a
 *                              short HS256 session cookie (tos_session)
 *   getOidcAuthContext()    -> verify the session, upsert Org+Member, RBAC from
 *                              IdP roles — returns the SAME AuthContext the rest
 *                              of the app already consumes (zero consumer change).
 *
 * The existing schema is reused: Organization.clerkOrgId / Member.clerkUserId
 * hold the IdP's org key / subject (they are just "external identity" columns).
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { MemberRole } from "@prisma/client";
import { db } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { AuthContext } from "@/lib/auth";

export const SESSION_COOKIE = "tos_session";
const STATE_COOKIE = "oidc_state";
const NONCE_COOKIE = "oidc_nonce";

export function isOidcAuth(): boolean {
  return process.env.AUTH_PROVIDER === "oidc";
}

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`OIDC: ${name} is required`);
  return v;
}
function redirectUri(): string {
  return `${reqEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "")}/api/auth/oidc/callback`;
}
function sessionKey(): Uint8Array {
  return new TextEncoder().encode(reqEnv("OIDC_SESSION_SECRET"));
}
function token(): string {
  return randomBytes(16).toString("hex");
}

// ── OIDC discovery + JWKS (cached) ─────────────────────────────────────────────

interface OidcMeta {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint?: string;
  jwks: ReturnType<typeof createRemoteJWKSet>;
}
let _meta: Promise<OidcMeta> | null = null;

function discover(): Promise<OidcMeta> {
  if (_meta) return _meta;
  _meta = (async () => {
    const issuer = reqEnv("OIDC_ISSUER").replace(/\/+$/, "");
    const res = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
    const d = (await res.json()) as Record<string, string>;
    return {
      issuer: d.issuer,
      authorization_endpoint: d.authorization_endpoint,
      token_endpoint: d.token_endpoint,
      end_session_endpoint: d.end_session_endpoint,
      jwks: createRemoteJWKSet(new URL(d.jwks_uri)),
    };
  })().catch((e) => {
    _meta = null; // allow retry on transient discovery failure
    throw e;
  });
  return _meta;
}

// ── Session shape ──────────────────────────────────────────────────────────────

interface SessionData {
  sub: string;
  email: string;
  name: string;
  org: string; // org key (claim or default for single-tenant)
  roles: string[];
}
interface SessionClaims extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  org: string;
  roles: string[];
}

async function issueSession(s: SessionData): Promise<string> {
  return new SignJWT({ email: s.email, name: s.name, org: s.org, roles: s.roles })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime(process.env.OIDC_SESSION_TTL ?? "8h")
    .sign(sessionKey());
}

async function readSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const tok = jar.get(SESSION_COOKIE)?.value;
  if (!tok) return null;
  try {
    const { payload } = await jwtVerify(tok, sessionKey());
    if (!payload.sub) return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

// ── Login (called by the route handlers) ───────────────────────────────────────

export async function beginLogin(): Promise<string> {
  const meta = await discover();
  const state = token();
  const nonce = token();
  const jar = await cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set(STATE_COOKIE, state, opts);
  jar.set(NONCE_COOKIE, nonce, opts);

  const url = new URL(meta.authorization_endpoint);
  url.searchParams.set("client_id", reqEnv("OIDC_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", process.env.OIDC_SCOPE ?? "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

export async function completeLogin(code: string, returnedState: string): Promise<void> {
  const jar = await cookies();
  const savedState = jar.get(STATE_COOKIE)?.value;
  const savedNonce = jar.get(NONCE_COOKIE)?.value;
  if (!savedState || returnedState !== savedState) throw new Error("OIDC state mismatch");

  const meta = await discover();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
    client_id: reqEnv("OIDC_CLIENT_ID"),
    client_secret: reqEnv("OIDC_CLIENT_SECRET"),
  });
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OIDC token exchange failed (${res.status})`);
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("OIDC: no id_token returned");

  const { payload } = await jwtVerify(tokens.id_token, meta.jwks, {
    issuer: meta.issuer,
    audience: reqEnv("OIDC_CLIENT_ID"),
  });
  if (savedNonce && payload.nonce && payload.nonce !== savedNonce) {
    throw new Error("OIDC nonce mismatch");
  }

  const session = await issueSession({
    sub: String(payload.sub),
    email: String(payload.email ?? payload.preferred_username ?? ""),
    name: String(payload.name ?? payload.preferred_username ?? payload.email ?? "User"),
    org: orgKey(payload),
    roles: extractRoles(payload),
  });

  jar.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  jar.delete(STATE_COOKIE);
  jar.delete(NONCE_COOKIE);
}

export async function logoutUrl(): Promise<string> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  const meta = await discover().catch(() => null);
  const post = `${reqEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "")}/sign-in`;
  if (meta?.end_session_endpoint) {
    const u = new URL(meta.end_session_endpoint);
    u.searchParams.set("post_logout_redirect_uri", post);
    u.searchParams.set("client_id", reqEnv("OIDC_CLIENT_ID"));
    return u.toString();
  }
  return post;
}

// ── Claims -> org + RBAC ───────────────────────────────────────────────────────

function orgKey(payload: JWTPayload): string {
  const claim = process.env.OIDC_ORG_CLAIM ?? "org";
  const v = payload[claim];
  if (typeof v === "string" && v) return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return process.env.OIDC_DEFAULT_ORG ?? "default";
}

function extractRoles(payload: JWTPayload): string[] {
  // Keycloak: realm_access.roles; also accept a flat groups/roles claim.
  const out: string[] = [];
  const realm = payload["realm_access"] as { roles?: unknown } | undefined;
  if (realm && Array.isArray(realm.roles)) out.push(...realm.roles.map(String));
  for (const k of ["roles", "groups", process.env.OIDC_ROLE_CLAIM ?? "roles"]) {
    const v = payload[k];
    if (Array.isArray(v)) out.push(...v.map(String));
  }
  return out;
}

const ROLE_RANK: MemberRole[] = [
  MemberRole.VIEWER,
  MemberRole.REVIEWER,
  MemberRole.WRITER,
  MemberRole.SENIOR_WRITER,
  MemberRole.MANAGER,
  MemberRole.ADMIN,
  MemberRole.OWNER,
];

/** Pick the highest app role implied by the IdP roles (suffix-matched, case-insensitive). */
function mapRoles(roles: string[]): MemberRole | null {
  let best: MemberRole | null = null;
  for (const raw of roles) {
    const name = raw.toLowerCase().replace(/[^a-z_]/g, "").replace(/^.*[:_/]/, "");
    const match = ROLE_RANK.find((r) => r.toLowerCase() === name);
    if (match && (!best || ROLE_RANK.indexOf(match) > ROLE_RANK.indexOf(best))) best = match;
  }
  return best;
}

// ── The context (delegated to by getAuthContext when AUTH_PROVIDER=oidc) ────────

export async function getOidcAuthContext(): Promise<AuthContext> {
  const s = await readSession();
  if (!s) redirect("/api/auth/oidc/login");

  // Upsert the org (single- or multi-tenant by the org claim).
  const org = await db.organization.upsert({
    where: { clerkOrgId: s.org },
    create: { clerkOrgId: s.org, name: s.org, slug: slugify(s.org) ?? s.org, isActive: true },
    update: {},
  });

  // RBAC: mapped IdP role; first member of a fresh org bootstraps as OWNER.
  const mapped = mapRoles(s.roles);
  const existingCount = await db.member.count({ where: { orgId: org.id } });
  const role = mapped ?? (existingCount === 0 ? MemberRole.OWNER : MemberRole.WRITER);

  const member = await db.member.upsert({
    where: { orgId_clerkUserId: { orgId: org.id, clerkUserId: s.sub } },
    create: {
      clerkUserId: s.sub,
      orgId: org.id,
      email: s.email || `${s.sub}@oidc.local`,
      name: s.name,
      role,
      isActive: true,
    },
    update: { name: s.name, email: s.email || undefined, role, isActive: true, deletedAt: null },
  });

  return { clerkUserId: s.sub, clerkOrgId: s.org, org, member };
}
