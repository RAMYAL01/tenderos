"use client";

import { useState } from "react";
import { UserPlus, Mail, Loader2, Copy, Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { createInvitation } from "@/lib/actions/invitations";
import type { MemberRole } from "@prisma/client";

/** Roles an admin can assign (OWNER excluded; ADMIN gated server-side to owners). */
const ROLES: { value: MemberRole; label: string; description: string }[] = [
  { value: "WRITER", label: "Writer", description: "Draft and edit proposals" },
  { value: "SENIOR_WRITER", label: "Senior Writer", description: "Lead drafting across tenders" },
  { value: "REVIEWER", label: "Reviewer", description: "Comment and approve only" },
  { value: "MANAGER", label: "Manager", description: "Manage tenders and assign tasks" },
  { value: "VIEWER", label: "Viewer", description: "Read-only access" },
  { value: "ADMIN", label: "Admin", description: "Full access except billing (owner only)" },
];

export function InviteMemberDialog({ canInviteAdmin = false }: { canInviteAdmin?: boolean }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("WRITER");
  const [isLoading, setIsLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const roles = ROLES.filter((r) => r.value !== "ADMIN" || canInviteAdmin);

  async function handleInvite() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await createInvitation({ email, role });
      if (!res.success) {
        toast({ title: "Could not invite", description: res.error, variant: "destructive" });
        return;
      }
      setLink(`${window.location.origin}${res.invitation.path}`);
      toast({ title: "Invite link ready", description: `Share it with ${email}.` });
    } finally {
      setIsLoading(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setEmail("");
    setRole("WRITER");
    setLink(null);
    setCopied(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to your workspace</DialogTitle>
          <DialogDescription>
            Generate a secure link to add a teammate to this company workspace.
          </DialogDescription>
        </DialogHeader>

        {!link ? (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Work email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as MemberRole)} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <div>
                          <span className="font-medium">{r.label}</span>
                          <p className="text-xs text-slate-500">{r.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleInvite} disabled={!email || isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Create invite link
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Send this link to <span className="font-medium">{email}</span>. It expires in 7 days
              and only works for that email.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button size="icon" variant="outline" onClick={copy} aria-label="Copy link">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Invite another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
