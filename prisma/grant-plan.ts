/**
 * Comp an organization to a full plan — FREE, no Stripe, no subscription, no
 * billing lock. The unblock for design partners, pilots, and sales demos while
 * billing is being set up (and forever for comped partners).
 *
 * Reuses applyPlanToOrg (the same path the Stripe webhook uses), so the org gets
 * real plan limits (seats, AI credits, proposals, saved searches). getBillingLock
 * returns unlocked because there's no Subscription row, so access never expires.
 *
 *   ORG_SLUG=acme-construction PLAN=BUSINESS npx tsx prisma/grant-plan.ts
 *   ORG_SLUG=acme PLAN=ENTERPRISE DESIGN_PARTNER=0 npx tsx prisma/grant-plan.ts
 *
 * PLAN ∈ STARTER | PROFESSIONAL | BUSINESS | ENTERPRISE (default BUSINESS).
 * Tags the org settings.designPartner=true unless DESIGN_PARTNER=0 — so pilots
 * are filterable in PostHog / queries.
 */
import type { PlanTier } from "@prisma/client";
import { db } from "../src/lib/prisma";
import { applyPlanToOrg } from "../src/lib/billing/sync";

const slug = process.env.ORG_SLUG;
const plan = (process.env.PLAN ?? "BUSINESS").toUpperCase();
const tagPartner = process.env.DESIGN_PARTNER !== "0";

const PLANS = ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"];
if (!slug) {
  console.error("Set ORG_SLUG (and optional PLAN=STARTER|PROFESSIONAL|BUSINESS|ENTERPRISE, DESIGN_PARTNER=0).");
  process.exit(1);
}
if (!PLANS.includes(plan)) {
  console.error(`Unknown PLAN "${plan}". Use one of: ${PLANS.join(", ")}.`);
  process.exit(1);
}

(async () => {
  const org = await db.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, settings: true },
  });
  if (!org) {
    console.error(`No organization with slug "${slug}".`);
    process.exit(1);
  }

  await applyPlanToOrg(org.id, plan as PlanTier);

  if (tagPartner) {
    const settings = (org.settings && typeof org.settings === "object" ? org.settings : {}) as Record<string, unknown>;
    await db.organization.update({
      where: { id: org.id },
      data: { settings: { ...settings, designPartner: true, compedAt: new Date().toISOString(), compedPlan: plan } },
    });
  }

  console.log(`✓ Granted ${plan} to "${org.name}" (${slug}) — free, no Stripe, unlocked${tagPartner ? " · tagged design-partner" : ""}.`);
  process.exit(0);
})().catch((e) => {
  console.error("grant-plan failed:", e);
  process.exit(1);
});
