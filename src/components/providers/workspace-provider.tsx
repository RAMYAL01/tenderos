"use client";

import { createContext, useContext } from "react";
import type { Organization, Member } from "@prisma/client";

interface WorkspaceContextValue {
  org: Organization;
  member: Member;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  org,
  member,
  children,
}: {
  org: Organization;
  member: Member;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={{ org, member }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Access the current organization and member from any client component
 * within the dashboard layout.
 *
 * For server components, use getAuthContext() from @/lib/auth instead.
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useWorkspace must be called inside <WorkspaceProvider>. " +
        "This usually means you called it outside of the dashboard layout."
    );
  }
  return ctx;
}
