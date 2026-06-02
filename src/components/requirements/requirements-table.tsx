"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Edit2, Search, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Requirement, RequirementType, RequirementPriority } from "@prisma/client";

const PRIORITY_STYLES: Record<RequirementPriority, string> = {
  CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
  HIGH:     "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400",
  MEDIUM:   "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
  LOW:      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const TYPE_STYLES: Record<RequirementType, string> = {
  MANDATORY:     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  OPTIONAL:      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  INFORMATIONAL: "bg-slate-100 text-slate-500",
  CONDITIONAL:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400",
};

interface RequirementsTableProps {
  requirements: Requirement[];
  canEdit: boolean;
  onRequirementUpdated: () => void;
}

export function RequirementsTable({
  requirements,
  canEdit,
  onRequirementUpdated,
}: RequirementsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ textEn: "", textAr: "" });

  // Filter requirements
  const filtered = requirements.filter((req) => {
    const matchesSearch =
      !searchQuery ||
      req.textEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.textAr?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      filterType === "all" || req.requirementType === filterType;

    const matchesPriority =
      filterPriority === "all" || req.priority === filterPriority;

    return matchesSearch && matchesType && matchesPriority && !req.deletedAt;
  });

  async function handleDelete(reqId: string) {
    if (!confirm("Delete this requirement?")) return;
    try {
      const res = await fetch(`/api/requirements/${reqId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Requirement deleted" });
      onRequirementUpdated();
    } catch {
      toast({ title: "Failed to delete requirement", variant: "destructive" });
    }
  }

  async function handleSaveEdit(reqId: string) {
    if (!editValues.textEn.trim()) return;
    try {
      const res = await fetch(`/api/requirements/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textEn: editValues.textEn, textAr: editValues.textAr || null }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast({ title: "Requirement updated" });
      setEditingId(null);
      onRequirementUpdated();
    } catch {
      toast({ title: "Failed to update requirement", variant: "destructive" });
    }
  }

  // Stats
  const mandatory = requirements.filter((r) => r.requirementType === "MANDATORY" && !r.deletedAt).length;
  const critical = requirements.filter((r) => r.priority === "CRITICAL" && !r.deletedAt).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats row */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-slate-600 dark:text-slate-400">
          <strong className="text-slate-900 dark:text-slate-100">{requirements.length}</strong> total requirements
        </span>
        <span className="text-blue-600">
          <strong>{mandatory}</strong> mandatory
        </span>
        <span className="text-red-600">
          <strong>{critical}</strong> critical
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search requirements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="MANDATORY">Mandatory</SelectItem>
            <SelectItem value="OPTIONAL">Optional</SelectItem>
            <SelectItem value="INFORMATIONAL">Informational</SelectItem>
            <SelectItem value="CONDITIONAL">Conditional</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="All priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            <SelectItem value="CRITICAL">Critical</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
          </SelectContent>
        </Select>

        {(searchQuery || filterType !== "all" || filterPriority !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setFilterType("all");
              setFilterPriority("all");
            }}
            className="text-slate-500 gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      {filtered.length !== requirements.length && (
        <p className="text-xs text-slate-500">
          Showing {filtered.length} of {requirements.length} requirements
        </p>
      )}

      {/* Empty state */}
      {requirements.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 dark:border-slate-700">
          <AlertTriangle className="mb-3 h-8 w-8 text-slate-300" />
          <p className="font-medium text-slate-600 dark:text-slate-400">
            No requirements extracted yet
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Upload a document and click "Extract Requirements"
          </p>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 w-8">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  Requirement
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell w-28">
                  Type
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell w-24">
                  Priority
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell w-24">
                  Section
                </th>
                {canEdit && <th className="w-16 px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {filtered.map((req, idx) => (
                <tr
                  key={req.id}
                  className={cn(
                    "group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50",
                    req.priority === "CRITICAL" && "bg-red-50/30 dark:bg-red-900/5"
                  )}
                >
                  {/* Row number */}
                  <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
                    {idx + 1}
                  </td>

                  {/* Requirement text */}
                  <td className="px-4 py-3">
                    {editingId === req.id ? (
                      <div className="flex flex-col gap-2">
                        <Input
                          value={editValues.textEn}
                          onChange={(e) => setEditValues((v) => ({ ...v, textEn: e.target.value }))}
                          className="text-sm"
                          placeholder="English text"
                        />
                        <Input
                          value={editValues.textAr}
                          onChange={(e) => setEditValues((v) => ({ ...v, textAr: e.target.value }))}
                          className="text-sm"
                          placeholder="Arabic text (optional)"
                          dir="rtl"
                          style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSaveEdit(req.id)} className="h-7 gap-1">
                            <Check className="h-3 w-3" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                          {req.priority === "CRITICAL" && (
                            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-red-500" />
                          )}
                          {req.textEn}
                        </p>
                        {req.textAr && (
                          <p
                            className="mt-1 text-xs text-slate-500"
                            dir="rtl"
                            style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
                          >
                            {req.textAr}
                          </p>
                        )}
                        {req.confidenceScore != null && req.confidenceScore < 0.7 && (
                          <p className="mt-0.5 text-[10px] text-amber-500">
                            Low confidence ({Math.round(req.confidenceScore * 100)}%) — review recommended
                          </p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Type */}
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      TYPE_STYLES[req.requirementType]
                    )}>
                      {req.requirementType.charAt(0) + req.requirementType.slice(1).toLowerCase()}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="hidden px-4 py-3 xl:table-cell">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                      PRIORITY_STYLES[req.priority]
                    )}>
                      {req.priority.charAt(0) + req.priority.slice(1).toLowerCase()}
                    </span>
                  </td>

                  {/* Section ref */}
                  <td className="hidden px-4 py-3 xl:table-cell">
                    {req.sectionRef ? (
                      <span className="text-xs text-slate-500 font-mono">{req.sectionRef}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingId(req.id);
                            setEditValues({ textEn: req.textEn ?? "", textAr: req.textAr ?? "" });
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-500"
                          onClick={() => handleDelete(req.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
