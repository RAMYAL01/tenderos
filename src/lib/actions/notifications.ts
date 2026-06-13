"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { savePreferences, type NotificationPrefs } from "@/lib/email/preferences";

/**
 * Notification preferences are PER-MEMBER and self-service — any member sets
 * their own. Org/tenant scoping is implicit: the row is keyed to the caller's
 * member id within their org, resolved from auth context (never trusted input).
 */
export async function updateNotificationPreferences(
  prefs: NotificationPrefs
): Promise<{ success: boolean; error?: string }> {
  try {
    const { org, member } = await getAuthContext();
    await savePreferences(org.id, member.id, {
      dailyDigest: Boolean(prefs.dailyDigest),
      proposalNotifications: Boolean(prefs.proposalNotifications),
      approvalNotifications: Boolean(prefs.approvalNotifications),
      billingNotifications: Boolean(prefs.billingNotifications),
    });
    revalidatePath("/settings/notifications");
    return { success: true };
  } catch (err) {
    console.error("updateNotificationPreferences error:", err);
    return { success: false, error: "Could not save your preferences." };
  }
}
