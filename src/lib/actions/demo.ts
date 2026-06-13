"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthContext, requireRole } from "@/lib/auth";
import { loadSampleTender, deleteSampleTender } from "@/lib/demo/sample-tender";
import { track, analyticsContext } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Demo Mode actions. startDemo seeds (idempotently) the sample tender and
 * returns its id so the client can jump straight into it — the no-upload path to
 * the full workflow. WRITER+ (it creates real tender rows, just flagged sample).
 */
export async function startDemo(): Promise<{ success: boolean; tenderId?: string; error?: string }> {
  try {
    const { clerkUserId, org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const tenderId = await loadSampleTender(org.id, member.id);

    after(() =>
      track(ANALYTICS_EVENTS.DEMO_MODE_STARTED, analyticsContext({ clerkUserId, org, member }), { tenderId })
    );

    revalidatePath("/tenders");
    revalidatePath("/dashboard");
    return { success: true, tenderId };
  } catch (err) {
    console.error("startDemo error:", err);
    return { success: false, error: "Could not load the sample tender." };
  }
}

export async function removeDemo(): Promise<{ success: boolean; error?: string }> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    await deleteSampleTender(org.id);

    revalidatePath("/tenders");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("removeDemo error:", err);
    return { success: false, error: "Could not remove the sample." };
  }
}
