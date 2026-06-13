import { db } from "@/lib/prisma";
import type { EmailCategory, MemberRole } from "@prisma/client";
import { CATEGORY_PREFERENCE_FIELD, type Recipient } from "./types";

/**
 * Resolve who should receive an email — always org-scoped, and always filtered
 * by the recipient's notification preference for that category. A member with no
 * preference row is treated as fully opted-in (the column defaults are all true).
 */

export const ROLE_SETS = {
  /** Billing + workspace-admin mail. */
  ADMINS: ["OWNER", "ADMIN"] as MemberRole[],
  /** Approval decisions. */
  MANAGERS_PLUS: ["OWNER", "ADMIN", "MANAGER"] as MemberRole[],
};

export async function resolveRecipients(
  orgId: string,
  opts: { roles?: MemberRole[]; category: EmailCategory }
): Promise<Recipient[]> {
  const members = await db.member.findMany({
    where: {
      orgId,
      isActive: true,
      deletedAt: null,
      ...(opts.roles ? { role: { in: opts.roles } } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      notificationPreference: {
        select: {
          dailyDigest: true,
          proposalNotifications: true,
          approvalNotifications: true,
          billingNotifications: true,
        },
      },
    },
  });

  const field = CATEGORY_PREFERENCE_FIELD[opts.category];

  return members
    .filter((m) => {
      if (!field) return true; // TRANSACTIONAL — never muted
      const pref = m.notificationPreference;
      return pref ? pref[field] === true : true; // no row → default-on
    })
    .map((m) => ({ memberId: m.id, email: m.email, name: m.name }));
}

/** A single member as a Recipient (used for member-targeted events). */
export async function memberRecipient(
  orgId: string,
  memberId: string
): Promise<Recipient | null> {
  const m = await db.member.findFirst({
    where: { id: memberId, orgId, isActive: true, deletedAt: null },
    select: { id: true, email: true, name: true },
  });
  return m ? { memberId: m.id, email: m.email, name: m.name } : null;
}
