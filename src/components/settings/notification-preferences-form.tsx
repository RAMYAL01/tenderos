"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, FileText, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { updateNotificationPreferences } from "@/lib/actions/notifications";
import type { NotificationPrefs } from "@/lib/email/preferences";

const ROWS: {
  key: keyof NotificationPrefs;
  label: string;
  description: string;
  icon: typeof Mail;
}[] = [
  {
    key: "dailyDigest",
    label: "Daily tender digest",
    description: "A morning email of new opportunities that match your profile.",
    icon: Mail,
  },
  {
    key: "proposalNotifications",
    label: "Proposal notifications",
    description: "When an AI proposal draft is ready for you to review.",
    icon: FileText,
  },
  {
    key: "approvalNotifications",
    label: "Approval notifications",
    description: "When a proposal needs your approval, or yours is approved.",
    icon: CheckCircle2,
  },
  {
    key: "billingNotifications",
    label: "Billing notifications",
    description: "Trial reminders, payment issues, and subscription changes.",
    icon: CreditCard,
  },
];

export function NotificationPreferencesForm({ initial }: { initial: NotificationPrefs }) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [saving, start] = useTransition();

  const dirty = ROWS.some((r) => prefs[r.key] !== initial[r.key]);

  function save() {
    start(async () => {
      const res = await updateNotificationPreferences(prefs);
      if (!res.success) {
        toast({ title: "Couldn't save", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Preferences saved" });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {ROWS.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.key} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{r.label}</p>
                  <p className="text-xs text-slate-500">{r.description}</p>
                </div>
              </div>
              <Switch
                checked={prefs[r.key]}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [r.key]: v }))}
                aria-label={r.label}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Essential emails — workspace invitations and security messages — are always sent.
      </p>

      <div className="mt-5 flex justify-end">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save preferences
        </Button>
      </div>
    </div>
  );
}
