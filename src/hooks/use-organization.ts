"use client";

import { useOrganization, useUser } from "@clerk/nextjs";

/**
 * Convenience hook that returns the current Clerk organization
 * and user context. Used in client components.
 *
 * For server components, use auth() + db directly.
 */
export function useWorkspace() {
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { user, isLoaded: userLoaded } = useUser();

  const isLoaded = orgLoaded && userLoaded;
  const isReady = isLoaded && !!organization && !!user;

  return {
    organization,
    user,
    isLoaded,
    isReady,
    // Convenience fields
    orgId: organization?.id ?? null,
    userId: user?.id ?? null,
    userEmail: user?.emailAddresses[0]?.emailAddress ?? null,
    userName: user?.fullName ?? user?.username ?? null,
    userAvatar: user?.imageUrl ?? null,
    orgName: organization?.name ?? null,
    orgSlug: organization?.slug ?? null,
    orgLogo: organization?.imageUrl ?? null,
  };
}
