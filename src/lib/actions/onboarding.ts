"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import type { OrganizationType } from "@prisma/client";

/**
 * Org-first onboarding actions. The COMPANY is the customer — these mutate the
 * Organization (the workspace), never a personal user account. OWNER/ADMIN only.
 */

const ORG_TYPES = [
  "GENERAL_CONTRACTOR",
  "EPC_CONTRACTOR",
  "CONSTRUCTION_COMPANY",
  "ENGINEERING_CONSULTANT",
  "FACILITIES_MANAGEMENT",
  "GOVERNMENT_AGENCY",
  "SUPPLIER_VENDOR",
  "OTHER",
] as const;

const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

const CompanyProfileSchema = z.object({
  name: z.string().min(2, "Company name is required").max(120),
  organizationType: z.enum(ORG_TYPES),
  countryCode: z.string().length(2),
  employeeCount: z.enum(EMPLOYEE_BANDS),
  website: z.string().url("Enter a valid URL").or(z.literal("")).optional(),
});

export type CompanyProfileInput = z.infer<typeof CompanyProfileSchema>;

type Result = { success: boolean; error?: string };

/** Step 1: capture the company workspace details. */
export async function saveCompanyProfile(input: CompanyProfileInput): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

    const parsed = CompanyProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid details" };
    }
    const d = parsed.data;

    await db.organization.update({
      where: { id: org.id },
      data: {
        name: d.name,
        slug: org.slug || slugify(d.name) || org.id,
        organizationType: d.organizationType as OrganizationType,
        countryCode: d.countryCode.toUpperCase(),
        employeeCount: d.employeeCount,
        website: d.website || null,
      },
    });

    revalidatePath("/onboarding");
    return { success: true };
  } catch (err) {
    console.error("saveCompanyProfile error:", err);
    return { success: false, error: "Could not save the company profile." };
  }
}

/** Final step: mark the workspace onboarding complete (lifts the dashboard gate). */
export async function completeOnboarding(): Promise<Result> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "ADMIN");

    await db.organization.update({
      where: { id: org.id },
      data: { onboardingCompletedAt: new Date() },
    });

    // Activation: seed the Discover feed from the just-captured company profile so
    // the workspace lands on a non-empty, personalized feed. Bounded + best-effort
    // — never blocks onboarding completion if matching hiccups.
    try {
      const { matchOpportunitiesForOrg } = await import("@/lib/discovery/match");
      await matchOpportunitiesForOrg(org.id);
    } catch (e) {
      console.warn("completeOnboarding: opportunity match skipped:", e);
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("completeOnboarding error:", err);
    return { success: false, error: "Could not finish setup." };
  }
}
