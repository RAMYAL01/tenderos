import { createHash } from "crypto";

/**
 * Invitation tokens are stored HASHED (like API keys): the DB row holds
 * sha256(rawToken); the raw token exists only in the link returned at creation.
 * A DB read leak therefore never exposes a usable join-link.
 */
export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
