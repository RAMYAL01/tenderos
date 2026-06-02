"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Download, History, Eye, ChevronLeft,
  FileText, GripVertical, CheckCircle2, Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SectionEditor } from "./section-editor";
import { ExportButton } from "./export-button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SECTION_TYPE_LABELS, DEFAULT_SECTION_ORDER } from "@/lib/constants";
import type { SectionType, RequirementPriority, ComplianceStatus } from "@prisma/client";

interface SectionData {
  id: string;
  sectionType: SectionType;
  titleEn: string | null;
  titleAr: string | null;
  contentEn: string | null;
  contentAr: string | null;
  isAiGenerated: boolean;
  orderIndex: number;
}

interface RequirementData {
  id: string;
  textEn: string | null;
  priority: string;
  complianceStatus: ComplianceStatus;
  sectionReference: string | null;
}

interface ProposalData {
  id: string;
  title: string;
  language: string;
  status: string;
  currentVersion: number;
  complianceScore: number | null;
  tender: {
    id: string;
    titleEn: string;
    clientName: string | null;
    tenderType: string | null;
  };
}

interface ProposalEditorProps {
  proposal: ProposalData;
  sections: SectionData[];
  requirements: RequirementData[];
  canEdit: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  EXPORTED: "Exported",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  IN_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED:  "bg-emerald-100 text-emerald-700",
  EXPORTED:  "bg-blue-100 text-blue-700",
};

export function ProposalEditor({
  proposal,
  sections: initialSections,
  requirements,
  canEdit,
}: ProposalEditorProps) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    initialSections[0]?.id ?? ""
  );

  const activeSection = sections.find((s) => s.id === activeSectionId);

  // Group requirements by section reference
  const requirementsBySectionType = requirements.reduce<
    Record<string, RequirementData[]>
  >((acc, req) => {
    const key = req.sectionReference ?? "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {});

  // For the active section, get its requirements
  const activeSectionRequirements = activeSection
    ? (requirementsBySectionType[activeSection.sectionType] ?? []).map((r) => ({
        id: r.id,
        textEn: r.textEn,
        priority: r.priority as RequirementPriority,
        isAddressed: r.complianceStatus === "COMPLETED",
      }))
    : [];

  // Count sections with content
  const sectionsWithContent = sections.filter(
    (s) => s.contentEn && s.contentEn.length > 50
  ).length;

  async function handleAddSection(sectionType: string) {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/sections/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          sectionType,
          orderIndex: sections.length,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSections((prev) => [...prev, data]);
        setActiveSectionId(data.id);
        toast({ title: "Section added" });
      }
    } catch {
      toast({ title: "Failed to add section", variant: "destructive" });
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!confirm("Delete this section? Content will be lost.")) return;
    try {
      await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      if (activeSectionId === sectionId) {
        setActiveSectionId(sections.find((s) => s.id !== sectionId)?.id ?? "");
      }
    } catch {
      toast({ title: "Failed to delete section", variant: "destructive" });
    }
  }

  // Sections not yet in the proposal (for the "Add" dropdown)
  const usedTypes = new Set(sections.map((s) => s.sectionType));
  const availableToAdd = DEFAULT_SECTION_ORDER.filter(
    (type) => !usedTypes.has(type) && type !== "COVER_LETTER"
  );

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
      {/* ── Left panel: section list ─────────────────────────────────────────── */}
      <div className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        {/* Proposal meta */}
        <div className="border-b border-slate-100 p-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => router.push(`/tenders/${proposal.tender.id}/proposals`)}
            className="mb-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="h-3 w-3" />
            All Proposals
          </button>
          <p className="line-clamp-2 text-xs font-medium text-slate-800 dark:text-slate-200">
            {proposal.title}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_STYLES[proposal.status])}>
              {STATUS_LABELS[proposal.status] ?? proposal.status}
            </span>
            {proposal.complianceScore != null && (
              <span className="text-[10px] text-slate-500">
                {Math.round(proposal.complianceScore)}% compliant
              </span>
            )}
          </div>
        </div>

        {/* Section list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sections.map((section) => {
            const label = SECTION_TYPE_LABELS[section.sectionType]?.en ?? section.sectionType;
            const hasContent = section.contentEn && section.contentEn.length > 50;
            const isActive = section.id === activeSectionId;
            const sectionReqs = requirementsBySectionType[section.sectionType] ?? [];
            const coveredReqs = sectionReqs.filter((r) => r.complianceStatus === "COMPLETED").length;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSectionId(section.id)}
                className={cn(
                  "group flex w-full items-start gap-2 px-3 py-2 text-left transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {hasContent ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{label}</p>
                  {sectionReqs.length > 0 && (
                    <p className="text-[10px] text-slate-400">
                      {coveredReqs}/{sectionReqs.length} reqs
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Add section */}
        {canEdit && availableToAdd.length > 0 && (
          <div className="border-t border-slate-100 p-2 dark:border-slate-800">
            <Select onValueChange={handleAddSection}>
              <SelectTrigger className="h-7 text-xs">
                <div className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  <span>Add section</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {availableToAdd.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {SECTION_TYPE_LABELS[type]?.en ?? type}
                  </SelectItem>
                ))}
                <SelectItem value="CUSTOM" className="text-xs">
                  Custom section
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Main: active section editor ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            <span>
              {sectionsWithContent}/{sections.length} sections drafted
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span>v{proposal.currentVersion}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => window.open(`/tenders/${proposal.tender.id}/proposals/${proposal.id}/preview`, "_blank")}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>

            <ExportButton
              proposalId={proposal.id}
              proposalTitle={proposal.title}
              language={proposal.language}
            />
          </div>
        </div>

        {/* Section editor */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeSection ? (
            <SectionEditor
              section={activeSection}
              tenderId={proposal.tender.id}
              proposalLanguage={proposal.language}
              isActive={true}
              canEdit={canEdit}
              sectionRequirements={activeSectionRequirements as any}
              onSaved={() => {}}
              onDelete={handleDeleteSection}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-500">Select a section to start editing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
