import "server-only";
import { logger } from "@/lib/logger";
import { PLAN_LIMITS } from "@/lib/constants";
import { getPostHogServer } from "./posthog-server";

/**
 * Organization group analytics (Phase 2). TenderOS is org-centric, so the
 * `organization` group is the primary unit of analysis — MRR, retention,
 * activation, and adoption are all measured per workspace, not per user.
 *
 * groupIdentify syncs org-level PROPERTIES (plan, country, industry, size) used
 * to break down every dashboard. Call it at moments the org profile changes:
 * onboarding completion and any plan change. Metadata only — the org NAME is the
 * most identifying thing sent, which Phase 2 explicitly requires.
 */

export interface OrgGroupInput {
  id: string;
  name: string;
  planTier: keyof typeof PLAN_LIMITS;
  countryCode?: string | null;
  industry?: string | null;
  organizationType?: string | null;
  employeeCount?: string | null;
  isActive?: boolean;
}

export async function identifyOrganization(org: OrgGroupInput, extra?: { memberCount?: number }): Promise<void> {
  const ph = getPostHogServer();
  if (!ph) return;
  try {
    ph.groupIdentify({
      groupType: "organization",
      groupKey: org.id,
      properties: {
        name: org.name,
        plan: PLAN_LIMITS[org.planTier]?.label ?? String(org.planTier),
        plan_tier: org.planTier,
        country: org.countryCode ?? undefined,
        industry: org.industry ?? undefined,
        organization_type: org.organizationType ?? undefined,
        employee_band: org.employeeCount ?? undefined,
        is_active: org.isActive ?? true,
        ...(extra?.memberCount != null ? { member_count: extra.memberCount } : {}),
      },
    });
    await ph.flush();
  } catch (err) {
    logger.error({ err, orgId: org.id }, "analytics: groupIdentify failed");
  }
}
