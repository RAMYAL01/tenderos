"use client";

import { useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Shield, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { updateMemberRole, removeMember } from "@/lib/actions/workspace";
import { format } from "date-fns";
import type { Member } from "@prisma/client";

const ROLE_BADGE_STYLES: Record<string, string> = {
  OWNER: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  MANAGER: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
  SENIOR_WRITER: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  WRITER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  REVIEWER: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  VIEWER: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SENIOR_WRITER: "Senior Writer",
  WRITER: "Writer",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

const ASSIGNABLE_ROLES = [
  "WRITER",
  "SENIOR_WRITER",
  "REVIEWER",
  "MANAGER",
  "ADMIN",
] as const;

interface MembersListProps {
  members: Member[];
  currentMemberId: string;
  canManage: boolean;
}

export function MembersList({
  members,
  currentMemberId,
  canManage,
}: MembersListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(memberId: string, newRole: string) {
    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole);
      if (result.success) {
        toast({ title: "Role updated successfully" });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  function handleRemove(memberId: string) {
    startTransition(async () => {
      const result = await removeMember(memberId);
      setRemovingId(null);
      if (result.success) {
        toast({ title: "Member removed" });
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  }

  if (members.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">No members found.</div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Member
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell">
                Last Login
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell">
                Joined
              </th>
              {canManage && <th className="w-10 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {members.map((member) => {
              const isCurrentUser = member.id === currentMemberId;
              const isOwner = member.role === "OWNER";
              const canModify = canManage && !isOwner && !isCurrentUser;

              return (
                <tr
                  key={member.id}
                  className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50"
                >
                  {/* Avatar + name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {member.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {member.name}
                          </span>
                          {isCurrentUser && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                              You
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        ROLE_BADGE_STYLES[member.role] ?? ""
                      }`}
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
                  </td>

                  {/* Last login */}
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="text-xs text-slate-500">
                      {member.lastLoginAt
                        ? format(new Date(member.lastLoginAt), "MMM d, yyyy")
                        : "Never"}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="hidden px-4 py-3 xl:table-cell">
                    <span className="text-xs text-slate-500">
                      {format(new Date(member.createdAt), "MMM d, yyyy")}
                    </span>
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="px-4 py-3">
                      {canModify && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={isPending}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel className="text-xs">
                              Change Role
                            </DropdownMenuLabel>
                            {ASSIGNABLE_ROLES.filter(
                              (r) => r !== member.role
                            ).map((role) => (
                              <DropdownMenuItem
                                key={role}
                                className="flex items-center gap-2"
                                onSelect={() =>
                                  handleRoleChange(member.id, role)
                                }
                              >
                                <Shield className="h-3.5 w-3.5 text-slate-400" />
                                Make {ROLE_LABELS[role]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="flex items-center gap-2 text-red-600 focus:bg-red-50 focus:text-red-600"
                              onSelect={() => setRemovingId(member.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove Member
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog
        open={removingId !== null}
        onOpenChange={(open) => !open && setRemovingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke their access to the workspace. They will lose
              access immediately. This action can be undone by re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
              onClick={() => removingId && handleRemove(removingId)}
            >
              {isPending ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
