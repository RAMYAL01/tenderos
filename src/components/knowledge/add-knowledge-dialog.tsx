"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { addKnowledgeItem, KNOWLEDGE_TYPES } from "@/lib/actions/knowledge";

const TYPE_LABELS: Record<string, string> = {
  case_study: "Case Study",
  past_performance: "Past Performance",
  cv: "CV / Resume",
  company_profile: "Company Profile",
  certification: "Certification",
  iso_document: "ISO Document",
  sop: "SOP",
  technical_report: "Technical Report",
  other: "Other",
};

export function AddKnowledgeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    title: "",
    content: "",
    knowledgeType: "case_study" as (typeof KNOWLEDGE_TYPES)[number],
  });

  function submit() {
    if (!form.title.trim() || form.content.trim().length < 10) {
      toast({ title: "Add a title and some content", variant: "destructive" });
      return;
    }
    start(async () => {
      const res = await addKnowledgeItem({
        title: form.title,
        content: form.content,
        knowledgeType: form.knowledgeType,
      });
      if (!res.success) {
        toast({ title: res.error ?? "Failed to add", variant: "destructive" });
        return;
      }
      toast({ title: "Added to Knowledge Brain", description: "Embedded and searchable." });
      setForm({ title: "", content: "", knowledgeType: form.knowledgeType });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Knowledge
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Knowledge Brain</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="k-type" className="text-xs">Type</Label>
            <Select
              value={form.knowledgeType}
              onValueChange={(v) => setForm({ ...form, knowledgeType: v as typeof form.knowledgeType })}
            >
              <SelectTrigger id="k-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="k-title" className="text-xs">Title</Label>
            <Input
              id="k-title"
              placeholder="e.g. Riyadh Airport FM Contract 2023"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="k-content" className="text-xs">Content</Label>
            <Textarea
              id="k-content"
              rows={8}
              placeholder="Paste the document text — project details, certifications, CV, case study…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              This text is embedded so the Knowledge Brain can retrieve it when answering questions.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add &amp; Embed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
