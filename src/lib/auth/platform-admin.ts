import { auth, currentUser } from "@clerk/nextjs/server";

/**
 * Platform operators (the TenderOS team) — distinct from per-org MemberRole.
 *
 * Operators are identified by an email allowlist in the PLATFORM_ADMIN_EMAILS
 * env var (comma-separated, case-insensitive). This gates cross-tenant operator
 * tooling such as the manual billing / invoicing console. When the var is unset
 * or empty, EVERYONE is denied — a safe default so the console is never open by
 * accident before it's configured.
 *
 * Set it in Vercel (Production + Preview), e.g.
 *   PLATFORM_ADMIN_EMAILS=founder@thetenderos.com,ops@thetenderos.com
 */
export function platformAdminEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether an arbitrary email is on the operator allowlist. */
export function isEmailPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = platformAdminEmails();
  return allow.length > 0 && allow.includes(email.trim().toLowerCase());
}

export interface PlatformAdminIdentity {
  userId: string;
  email: string;
}

/**
 * Resolve the current Clerk user to a platform-operator identity, or null if
 * they are not signed in / not on the allowlist. Reads every verified email on
 * the account so an operator with multiple emails still matches.
 */
export async function getPlatformAdmin(): Promise<PlatformAdminIdentity | null> {
  const { userId } = await auth();
  if (!userId) return null;
  if (platformAdminEmails().length === 0) return null; // not configured → deny

  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) =>
    e.emailAddress.toLowerCase()
  );
  const match = emails.find((e) => isEmailPlatformAdmin(e));
  return match ? { userId, email: match } : null;
}

/** Convenience boolean form for UI/guards. */
export async function isPlatformAdmin(): Promise<boolean> {
  return (await getPlatformAdmin()) !== null;
}

/**
 * Guard for operator API routes. Returns the operator identity when allowed,
 * or throws {@link PlatformAdminForbiddenError} which callers map to a 403.
 */
export class PlatformAdminForbiddenError extends Error {
  constructor() {
    super("Forbidden: platform operator access required");
    this.name = "PlatformAdminForbiddenError";
  }
}

export async function requirePlatformAdmin(): Promise<PlatformAdminIdentity> {
  const identity = await getPlatformAdmin();
  if (!identity) throw new PlatformAdminForbiddenError();
  return identity;
}
