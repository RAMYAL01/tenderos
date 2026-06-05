"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createProposal } from "@/lib/actions/proposals";
import { toast } from "@/hooks/use-toast";

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English only" },
  { value: "AR", label: "Arabic only" },
  { value: "AR_SA", label: "Arabic — Saudi Arabia" },
  { value: "AR_AE", label: "Arabic — UAE" },
  { value: "AR_EG", label: "Arabic — Egypt" },
  { value: "BILINGUAL", label: "Bilingual (English + Arabic)" },
];

interface CreateProposalDialogProps {
  tenderId: string;
  defaultLanguage?: string;
  trigger?: React.ReactNode;
}

export function CreateProposalDialog({
  tenderId,
  defaultLanguage = "EN",
  trigger,
}: CreateProposalDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("Technical Proposal");
  const [language, setLanguage] = useState(defaultLanguage);

  function handleCreate() {
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createProposal({ tenderId, title, language: language as any });
      if (result.success && result.id) {
        toast({ title: "Proposal created ✓" });
        setOpen(false);
        router.push(`/tenders/${tenderId}/proposals/${result.id}`);
      } else {
        toast({ title: "Failed to create proposal", description: result.error, variant: "destructive" });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            New Proposal
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Proposal</DialogTitle>
          <DialogDescription>
            A proposal is created with default sections. You can add, remove, and
            reorder sections in the editor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="proposal-title">Proposal Title</Label>
            <Input
              id="proposal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Technical Proposal — Rev A"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim() || isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create & Open Editor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
