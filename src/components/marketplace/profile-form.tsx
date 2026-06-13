"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Globe2, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { upsertMarketplaceProfile, setMarketplacePublished } from "@/lib/actions/marketplace";
import type { OwnProfile } from "@/lib/data/marketplace";

const BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"];

const splitTags = (s: string) =>
  Array.from(new Set(s.split(",").map((x) => x.trim()).filter(Boolean)));

export function ProfileForm({ profile }: { profile: OwnProfile | null }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [publishing, startPublish] = useTransition();

  const [form, setForm] = useState({
    displayName: profile?.displayName ?? "",
    displayNameAr: profile?.displayNameAr ?? "",
    country: profile?.country ?? "",
    employeeBand: profile?.employeeBand ?? "",
    sectors: (profile?.sectors ?? []).join(", "),
    capabilities: (profile?.capabilities ?? []).join(", "),
    blurb: profile?.blurb ?? "",
    website: profile?.website ?? "",
    contactName: profile?.contactName ?? "",
    contactEmail: profile?.contactEmail ?? "",
  });
  const published = profile?.published ?? false;

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    startSave(async () => {
      const res = await upsertMarketplaceProfile({
        displayName: form.displayName.trim(),
        displayNameAr: form.displayNameAr.trim() || null,
        country: form.country.trim().toUpperCase() || null,
        employeeBand: form.employeeBand || null,
        sectors: splitTags(form.sectors),
        capabilities: splitTags(form.capabilities),
        blurb: form.blurb.trim() || null,
        website: form.website.trim() || null,
        contactName: form.contactName.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
      });
      if (!res.success) {
        toast({ title: "Couldn't save", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Profile saved", description: published ? "Your live listing is updated." : "Saved as a draft." });
      router.refresh();
    });
  }

  function togglePublish(next: boolean) {
    startPublish(async () => {
      const res = await setMarketplacePublished(next);
      if (!res.success) {
        toast({ title: "Couldn't update", description: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: next ? "You're listed" : "Listing hidden",
        description: next
          ? "Your firm now appears in the partner directory."
          : "Your profile is hidden from the directory.",
      });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      {/* Publish state */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          {published ? (
            <Globe2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <EyeOff className="mt-0.5 h-5 w-5 text-slate-400" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {published ? "Listed in the directory" : "Not listed"}
            </p>
            <p className="text-xs text-slate-500">
              {published
                ? "Other contractors can find you and request a connection."
                : "Save your details, then publish to appear in the directory."}
            </p>
          </div>
        </div>
        <Switch
          checked={published}
          onCheckedChange={togglePublish}
          disabled={publishing || !profile}
          aria-label="Publish profile"
        />
      </div>

      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" required>
            <Input value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Arabic name">
            <Input
              value={form.displayNameAr}
              onChange={(e) => set("displayNameAr")(e.target.value)}
              dir="rtl"
              maxLength={120}
            />
          </Field>
          <Field label="Country (ISO code)">
            <Input
              value={form.country}
              onChange={(e) => set("country")(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="SA"
              maxLength={2}
            />
          </Field>
          <Field label="Company size">
            <Select value={form.employeeBand} onValueChange={set("employeeBand")}>
              <SelectTrigger>
                <SelectValue placeholder="Select a band" />
              </SelectTrigger>
              <SelectContent>
                {BANDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b} employees
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Sectors" hint="Comma-separated — e.g. construction, facilities, oil_gas">
          <Input value={form.sectors} onChange={(e) => set("sectors")(e.target.value)} placeholder="construction, facilities" />
          <TagPreview value={form.sectors} variant="secondary" />
        </Field>

        <Field label="Capabilities" hint="Comma-separated strengths — e.g. EPC, MEP, civil, fit-out">
          <Input value={form.capabilities} onChange={(e) => set("capabilities")(e.target.value)} placeholder="EPC, MEP, civil" />
          <TagPreview value={form.capabilities} variant="outline" />
        </Field>

        <Field label="About" hint="A short pitch other firms will see.">
          <Textarea value={form.blurb} onChange={(e) => set("blurb")(e.target.value)} rows={4} maxLength={2000} />
        </Field>

        <Field label="Website">
          <Input value={form.website} onChange={(e) => set("website")(e.target.value)} placeholder="https://…" maxLength={200} />
        </Field>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="mb-3 text-xs font-medium text-slate-500">
            Private — shared only with firms you accept a connection with.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name">
              <Input value={form.contactName} onChange={(e) => set("contactName")(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Contact email">
              <Input
                value={form.contactEmail}
                onChange={(e) => set("contactEmail")(e.target.value)}
                type="email"
                placeholder="bd@yourfirm.com"
                maxLength={200}
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save profile
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function TagPreview({ value, variant }: { value: string; variant: "secondary" | "outline" }) {
  const tags = splitTags(value);
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {tags.map((t) => (
        <Badge key={t} variant={variant} className="text-[11px]">
          {t}
        </Badge>
      ))}
    </div>
  );
}
