import { db } from "@/lib/prisma";

/**
 * Notification-preference data layer. One row per member; auto-created with all
 * categories enabled the first time it's read. The settings UI and the recipient
 * resolver both go through here.
 */

export interface NotificationPrefs {
  dailyDigest: boolean;
  proposalNotifications: boolean;
  approvalNotifications: boolean;
  billingNotifications: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
  dailyDigest: true,
  proposalNotifications: true,
  approvalNotifications: true,
  billingNotifications: true,
};

/** Read a member's preferences, creating the default row if absent. Org-scoped. */
export async function getOrCreatePreferences(
  orgId: string,
  memberId: string
): Promise<NotificationPrefs> {
  const row = await db.notificationPreference.upsert({
    where: { memberId },
    create: { orgId, memberId },
    update: {},
    select: {
      dailyDigest: true,
      proposalNotifications: true,
      approvalNotifications: true,
      billingNotifications: true,
    },
  });
  return row;
}

/** Persist a member's preferences (org-scoped upsert). */
export async function savePreferences(
  orgId: string,
  memberId: string,
  prefs: NotificationPrefs
): Promise<void> {
  await db.notificationPreference.upsert({
    where: { memberId },
    create: { orgId, memberId, ...prefs },
    update: { ...prefs },
  });
}
