"use client";

import { useState } from "react";
import { CheckCircle2, Circle, AlertCircle, MinusCircle, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { FeedbackButtons } from "@/components/feedback/feedback-buttons";
import { recordAIFeedback } from "@/lib/actions/feedback";
import type { ComplianceStatus, RequirementPriority, RequirementType } from "@prisma/client";

function rowLang(r: { textEn: string | null; textAr: string | null }): "en" | "ar" | "mixed" {
  if (r.textEn && r.textAr) return "mixed";
  if (r.textAr) return "ar";
  return "en";
}

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  NOT_STARTED:   { label: "Not Started", icon: Circle,       color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-900" },
  IN_PROGRESS:   { label: "In Progress", icon: AlertCircle,  color: "text-amber-500",  bg: "bg-amber-50/50 dark:bg-amber-900/10" },
  COMPLETED:     { label: "Complete",    icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50/50 dark:bg-emerald-900/10" },
  NOT_APPLICABLE: { label: "N/A",        icon: MinusCircle,  color: "text-slate-400",  bg: "bg-slate-50 dark:bg-slate-900" },
  FLAGGED:       { label: "Flagged",     icon: Flag,         color: "text-red-500",    bg: "bg-red-50/50 dark:bg-red-900/10" },
};

const PRIORITY_BADGE: Record<RequirementPriority, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH:     "bg-orange-100 text-orange-700",
  MEDIUM:   "bg-amber-100 text-amber-700",
  LOW:      "bg-slate-100 text-slate-500",
};

interface MatrixRow {
  id: string;
  status: ComplianceStatus;
  responseEn: string | null;
  responseAr: string | null;
  sectionReference: string | null;
  requirement: {
    id: string;
    textEn: string | null;
    textAr: string | null;
    requirementType: RequirementType;
    priority: RequirementPriority;
    sectionRef: string | null;
  };
  assignedTo: { id: string; name: string; avatarUrl: string | null } | null;
}

interface ComplianceMatrixProps {
  rows: MatrixRow[];
  canEdit: boolean;
  tenderId: string;
}

export function ComplianceMatrix({ rows, canEdit }: ComplianceMatrixProps) {
  const [localRows, setLocalRows] = useState(rows);
  // The AI's original verdict per row, captured at mount. Overriding it later
  // is an EDIT training signal (chosen = human, rejected = AI).
  const [aiStatus] = useState<Record<string, ComplianceStatus>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.status]))
  );

  const total = localRows.length;
  const completed = localRows.filter((r) => r.status === "COMPLETED").length;
  const gaps = localRows.filter(
    (r) =>
      r.status === "NOT_STARTED" &&
      (r.requirement.requirementType === "MANDATORY" ||
        r.requirement.priority === "CRITICAL")
  ).length;
  const score = total > 0 ? Math.round((completed / total) * 100) : 0;

  async function updateStatus(rowId: string, status: ComplianceStatus) {
    try {
      const res = await fetch(`/api/compliance/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLocalRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, status } : r)));

      // Training signal: overriding the AI's original verdict is an EDIT.
      const row = localRows.find((r) => r.id === rowId);
      const original = aiStatus[rowId];
      if (row && original && original !== status) {
        void recordAIFeedback({
          task: "compliance_analysis",
          action: "EDIT",
          inputRef: row.requirement.id,
          inputText: row.requirement.textEn ?? row.requirement.textAr ?? undefined,
          lang: rowLang(row.requirement),
          aiOutput: { status: original },
          humanOutput: { status },
        });
      }
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-20 text-center dark:border-slate-700">
        <CheckCircle2 className="mb-3 h-10 w-10 text-slate-300" />
        <p className="font-medium text-slate-600 dark:text-slate-400">No compliance matrix yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Extract requirements first, then generate the compliance matrix
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Score header */}
      <div className="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col">
          <span className={cn("text-3xl font-bold tabular-nums", score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-red-600")}>
            {score}%
          </span>
          <span className="text-xs text-slate-500">Compliance Coverage</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{completed}</span>
          <span className="text-xs text-slate-500">Completed</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{total - completed}</span>
          <span className="text-xs text-slate-500">Remaining</span>
        </div>
        {gaps > 0 && (
          <div className="flex flex-col">
            <span className="text-2xl font-bold tabular-nums text-red-600">{gaps}</span>
            <span className="text-xs text-slate-500">Critical Gaps</span>
          </div>
        )}
      </div>

      {/* Matrix table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-8">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">Requirement</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell w-28">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-32">Status</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell">Response Preview</th>
              {canEdit && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-20">AI</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {localRows.map((row, idx) => {
              const statusCfg = STATUS_CONFIG[row.status];
              const StatusIcon = statusCfg.icon;
              return (
                <tr key={row.id} className={cn("group transition-colors", statusCfg.bg)}>
                  <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                      {row.requirement.textEn}
                    </p>
                    {row.requirement.textAr && (
                      <p className="mt-0.5 text-xs text-slate-500" dir="rtl"
                        style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}>
                        {row.requirement.textAr}
                      </p>
                    )}
                    {row.requirement.sectionRef && (
                      <span className="mt-1 text-[10px] font-mono text-slate-400">{row.requirement.sectionRef}</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY_BADGE[row.requirement.priority])}>
                      {row.requirement.priority.charAt(0) + row.requirement.priority.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit ? (
                      <select
                        value={row.status}
                        onChange={(e) => updateStatus(row.id, e.target.value as ComplianceStatus)}
                        className={cn(
                          "rounded-md border border-transparent px-2 py-1 text-xs font-medium transition-colors",
                          "bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500",
                          statusCfg.color
                        )}
                      >
                        {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                          <option key={val} value={val}>{cfg.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", statusCfg.color)}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {statusCfg.label}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 xl:table-cell">
                    {row.responseEn ? (
                      <p className="line-clamp-2 text-xs text-slate-500">{row.responseEn}</p>
                    ) : (
                      <span className="text-xs text-slate-300">No response yet</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="opacity-0 transition-opacity group-hover:opacity-100">
                        <FeedbackButtons
                          base={{
                            task: "compliance_analysis",
                            inputRef: row.requirement.id,
                            inputText: row.requirement.textEn ?? row.requirement.textAr ?? undefined,
                            lang: rowLang(row.requirement),
                            aiOutput: { status: aiStatus[row.id] ?? row.status },
                          }}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
