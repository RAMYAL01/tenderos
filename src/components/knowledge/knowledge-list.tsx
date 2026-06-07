"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, FileText, BadgeCheck, Briefcase, User, Building2, ScrollText } from "lucide-react";
import { deleteKnowledgeItem } from "@/lib/actions/knowledge";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  title: string;
  type: string;
  snippet: string;
  embedded: boolean;
}

const TYPE_META: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  case_study: { label: "Case Study", icon: Briefcase, color: "text-blue-600 bg-blue-50 dark:bg-blue-950" },
  past_performance: { label: "Past Performance", icon: BadgeCheck, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950" },
  cv: { label: "CV", icon: User, color: "text-violet-600 bg-violet-50 dark:bg-violet-950" },
  company_profile: { label: "Company Profile", icon: Building2, color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950" },
  certification: { label: "Certification", icon: BadgeCheck, color: "text-amber-600 bg-amber-50 dark:bg-amber-950" },
  iso_document: { label: "ISO Document", icon: ScrollText, color: "text-rose-600 bg-rose-50 dark:bg-rose-950" },
  sop: { label: "SOP", icon: ScrollText, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
  technical_report: { label: "Technical Report", icon: FileText, color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950" },
  other: { label: "Other", icon: FileText, color: "text-slate-600 bg-slate-100 dark:bg-slate-800" },
};

export function KnowledgeList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(id: string) {
    if (!confirm("Remove this document from the Knowledge Brain?")) return;
    start(async () => {
      const res = await deleteKnowledgeItem(id);
      if (!res.success) toast({ title: res.error ?? "Failed", variant: "destructive" });
      else router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-600/25">
          <FileText className="h-7 w-7" />
        </div>
        <p className="font-semibold text-slate-700 dark:text-slate-200">No documents yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">
          Add case studies, certifications, CVs, and past performance to build your knowledge base.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((it) => {
        const meta = TYPE_META[it.type] ?? TYPE_META.other;
        const Icon = meta.icon;
        return (
          <div
            key={it.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.color}`}>
                <Icon className="h-3 w-3" />
                {meta.label}
              </span>
              <button
                onClick={() => remove(it.id)}
                disabled={pending}
                className="text-slate-300 opacity-0 transition-all hover:text-red-500 group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <h4 className="line-clamp-1 font-semibold text-slate-900 dark:text-white">{it.title}</h4>
            <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-500">{it.snippet}</p>
            <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-400 dark:border-slate-800">
              <span className={`h-1.5 w-1.5 rounded-full ${it.embedded ? "bg-emerald-500" : "bg-amber-500"}`} />
              {it.embedded ? "Embedded · searchable" : "Not embedded"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
