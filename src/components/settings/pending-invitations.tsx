"use client";

import { useState, useTransition } from "react";
import { Link2, Check, X, Clock, MailCheck, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  createInvitation,
  revokeInvitation,
  type InvitationDTO,
} from "@/lib/actions/invitations";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  SENIOR_WRITER: "Senior Writer",
  WRITER: "Writer",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

const STATUS_META: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30", icon: Clock },
  ACCEPTED: { label: "Accepted", cls: "text-green-600 bg-green-50 dark:bg-green-950/30", icon: MailCheck },
  REVOKED: { label: "Revoked", cls: "text-slate-500 bg-slate-100 dark:bg-slate-800", icon: Ban },
  EXPIRED: { label: "Expired", cls: "text-slate-500 bg-slate-100 dark:bg-slate-800", icon: Clock },
};

export function PendingInvitations({
  invitations,
  canManage,
}: {
  invitations: InvitationDTO[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  /**
   * Invite tokens are stored hashed, so the original link can't be re-read.
   * "Copy link" mints a FRESH link for the same email+role (server-side upsert
   * rotates the token + extends expiry) and copies it.
   */
  function copy(inv: InvitationDTO) {
    startTransition(async () => {
      const res = await createInvitation({ email: inv.email, role: inv.role });
      if (!res.success || !res.invitation.path) {
        toast({
          title: "Could not generate link",
          description: !res.success ? res.error : undefined,
          variant: "destructive",
        });
        return;
      }
      await navigator.clipboard.writeText(`${window.location.origin}${res.invitation.path}`);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 1500);
      toast({ title: "Fresh invite link copied", description: `Valid for 7 days — ${inv.email}` });
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const res = await revokeInvitation(id);
      if (!res.success) {
        toast({ title: "Could not revoke", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Invitation revoked" });
      }
    });
  }

  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
        Invitations
      </h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        {invitations.map((inv, i) => {
          const meta = STATUS_META[inv.status] ?? STATUS_META.PENDING;
          const Icon = meta.icon;
          return (
            <div
              key={inv.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3",
                i > 0 && "border-t border-slate-100 dark:border-slate-800"
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {inv.email}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ROLE_LABEL[inv.role] ?? inv.role}
                </p>
              </div>

              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  meta.cls
                )}
              >
                <Icon className="h-3 w-3" /> {meta.label}
              </span>

              {inv.status === "PENDING" && canManage && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => copy(inv)}
                    disabled={pending}
                    aria-label="Copy a fresh invite link"
                  >
                    {copiedId === inv.id ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    onClick={() => revoke(inv.id)}
                    disabled={pending}
                    aria-label="Revoke invitation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
