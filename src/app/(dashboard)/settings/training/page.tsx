import { redirect } from "next/navigation";
import { Brain, Download, ThumbsUp, Pencil, ThumbsDown, Layers, Languages } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getTrainingStats } from "@/lib/training/export";

export const metadata = { title: "Training Data" };
export const dynamic = "force-dynamic";

const TASK_LABELS: Record<string, string> = {
  requirement_extraction: "Requirement extraction",
  compliance_analysis: "Compliance analysis",
  risk_identification: "Risk identification",
  proposal_generation: "Proposal generation",
  scope_interpretation: "Scope interpretation",
  boq_classification: "BOQ classification",
};
const LANG_LABELS: Record<string, string> = { en: "English", ar: "Arabic", mixed: "Bilingual", unknown: "Unspecified" };
const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ACCEPT: { label: "Accepted", icon: ThumbsUp, color: "text-emerald-600" },
  EDIT: { label: "Edited", icon: Pencil, color: "text-blue-600" },
  REJECT: { label: "Rejected", icon: ThumbsDown, color: "text-red-600" },
};

export default async function TrainingDataPage() {
  const { org, member } = await getAuthContext();
  if (!hasRole(member.role, "ADMIN")) redirect("/settings/workspace");

  const stats = await getTrainingStats(org.id);
  const maxTask = Math.max(1, ...stats.byTask.map((t) => t.count));
  const maxLang = Math.max(1, ...stats.byLang.map((l) => l.count));

  return (
    <>
      <PageHeader
        title="Training Data"
        description="Feedback your team gives on AI outputs becomes fine-tuning data for the tender model."
      />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Brain} grad="from-blue-500 to-blue-600" glow="from-blue-400 to-cyan-400" value={stats.total} label="Total signals" />
          <Kpi icon={Layers} grad="from-emerald-500 to-teal-600" glow="from-emerald-400 to-teal-400" value={stats.exportable} label="SFT examples" />
          <Kpi icon={Pencil} grad="from-violet-500 to-fuchsia-600" glow="from-violet-400 to-fuchsia-400" value={stats.dpoPairs} label="DPO pairs" />
          <Kpi icon={Download} grad="from-amber-500 to-orange-600" glow="from-amber-400 to-orange-400" value={stats.pending} label="Pending export" />
        </div>

        {/* Export */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Export this workspace&apos;s dataset</h3>
          <p className="mt-1 text-sm text-slate-500">
            De-identified JSONL (org/tender ids hashed; prices &amp; PII scrubbed). Use for a private per-tenant adapter.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="/api/training/export?kind=sft"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:-translate-y-px hover:to-blue-700"
            >
              <Download className="h-4 w-4" /> SFT ({stats.exportable})
            </a>
            <a
              href="/api/training/export?kind=dpo"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-px hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Download className="h-4 w-4" /> DPO ({stats.dpoPairs})
            </a>
          </div>
        </div>

        {stats.total === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
            <Brain className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-600 dark:text-slate-300">No feedback yet</p>
            <p className="mt-1 text-sm text-slate-400">
              When your team uses 👍/👎 or overrides an AI verdict, it shows up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {/* By task */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Layers className="h-4 w-4 text-slate-400" /> By task
              </h3>
              <div className="space-y-3">
                {stats.byTask.map((t) => (
                  <Bar key={t.task} label={TASK_LABELS[t.task] ?? t.task} count={t.count} max={maxTask} grad="from-blue-500 to-cyan-400" />
                ))}
              </div>
            </div>

            {/* By language + actions */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Languages className="h-4 w-4 text-slate-400" /> By language
                </h3>
                <div className="space-y-3">
                  {stats.byLang.map((l) => (
                    <Bar key={l.lang} label={LANG_LABELS[l.lang] ?? l.lang} count={l.count} max={maxLang} grad="from-emerald-500 to-teal-400" />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Signal mix</h3>
                <div className="flex flex-wrap gap-4">
                  {stats.byAction.map((a) => {
                    const m = ACTION_META[a.action] ?? { label: a.action, icon: Layers, color: "text-slate-500" };
                    const Icon = m.icon;
                    return (
                      <div key={a.action} className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${m.color}`} />
                        <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{a.count}</span>
                        <span className="text-xs text-slate-500">{m.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Kpi({ icon: Icon, grad, glow, value, label }: { icon: React.ElementType; grad: string; glow: string; value: number; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${glow} opacity-20 blur-2xl`} />
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-md`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="relative mt-3 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value.toLocaleString()}</p>
      <p className="relative text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Bar({ label, count, max, grad }: { label: string; count: number; max: number; grad: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{count}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
      </div>
    </div>
  );
}
