import "server-only";
import { getPostHogServer } from "./posthog-server";

/**
 * Feature flags (Phase 9) — server-side evaluation, org-aware. Flags are
 * evaluated against the PostHog `organization` group, so a rollout, beta gate, or
 * A/B experiment can target by plan, country, or any org property — and a whole
 * workspace gets a consistent experience (not per-user flicker).
 *
 * Registry below is the canonical list; create matching flags in PostHog →
 * Feature Flags. Reads are no-ops returning the default when PostHog is
 * unconfigured, so gated features simply fall back to their default branch.
 */

export const FEATURE_FLAGS = {
  // Early-access / beta
  MARKETPLACE_BETA: "marketplace-beta",
  AI_PROPOSAL_AUTOPILOT: "ai-proposal-autopilot",
  // Gradual rollout
  NEW_DISCOVERY_RANKER: "new-discovery-ranker",
  // Plan-based experiment / A-B
  ONBOARDING_CHECKLIST_VARIANT: "onboarding-checklist-variant",
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/** Is a boolean flag enabled for this user (+ their org group)? */
export async function isFeatureEnabled(
  flag: FeatureFlag,
  userId: string,
  organizationId: string,
  defaultValue = false
): Promise<boolean> {
  const ph = getPostHogServer();
  if (!ph) return defaultValue;
  try {
    const v = await ph.isFeatureEnabled(flag, userId, {
      groups: { organization: organizationId },
    });
    return v ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Multivariate flag value (A/B/n experiments). Returns the variant key or default. */
export async function getFeatureFlag(
  flag: FeatureFlag,
  userId: string,
  organizationId: string,
  defaultValue: string | boolean = false
): Promise<string | boolean> {
  const ph = getPostHogServer();
  if (!ph) return defaultValue;
  try {
    const v = await ph.getFeatureFlag(flag, userId, {
      groups: { organization: organizationId },
    });
    return v ?? defaultValue;
  } catch {
    return defaultValue;
  }
}
