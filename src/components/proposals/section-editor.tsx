"use client";

import { useState, useCallback, useRef } from "react";
import { Save, Loader2, ChevronDown, ChevronUp, Languages, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TiptapEditor } from "./tiptap-editor";
import { AIAssistantPanel } from "./ai-assistant-panel";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { SECTION_TYPE_LABELS } from "@/lib/constants";
import type { SectionType } from "@prisma/client";

interface SectionEditorProps {
  section: {
    id: string;
    sectionType: SectionType;
    titleEn: string | null;
    titleAr: string | null;
    contentEn: string | null;
    contentAr: string | null;
    isAiGenerated: boolean;
    orderIndex: number;
  };
  tenderId: string;
  proposalLanguage: string;
  isActive: boolean;
  canEdit: boolean;
  sectionRequirements?: Array<{
    id: string;
    textEn: string | null;
    priority: string;
    isAddressed: boolean;
  }>;
  onSaved?: () => void;
  onDelete?: (id: string) => void;
  className?: string;
}

/**
 * Single section editor with:
 * - Tiptap rich text editor (English + optional Arabic tabs)
 * - AI assistant sidebar
 * - Auto-save with debounce
 * - Language tabs (EN / AR)
 */
export function SectionEditor({
  section,
  tenderId,
  proposalLanguage,
  isActive,
  canEdit,
  sectionRequirements = [],
  onSaved,
  onDelete,
  className,
}: SectionEditorProps) {
  const [contentEn, setContentEn] = useState(section.contentEn ?? "");
  const [contentAr, setContentAr] = useState(section.contentAr ?? "");
  const [activeTab, setActiveTab] = useState<"en" | "ar">("en");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAI, setShowAI] = useState(true);
  const [isAiGenerated, setIsAiGenerated] = useState(section.isAiGenerated);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const sectionLabel =
    SECTION_TYPE_LABELS[section.sectionType]?.en ??
    section.sectionType.replace(/_/g, " ");

  const isBilingual =
    proposalLanguage === "BILINGUAL" ||
    proposalLanguage === "AR_SA" ||
    proposalLanguage === "AR_AE";

  const showArabicTab = isBilingual || proposalLanguage === "AR";

  // Debounced auto-save
  const handleContentChange = useCallback(
    (lang: "en" | "ar", html: string) => {
      if (lang === "en") setContentEn(html);
      else setContentAr(html);
      setHasUnsavedChanges(true);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => autoSave(lang, html), 2500);
    },
    [section.id]
  );

  async function autoSave(lang: "en" | "ar", html: string) {
    setIsSaving(true);
    try {
      await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          lang === "en" ? { contentEn: html } : { contentAr: html }
        ),
      });
      setHasUnsavedChanges(false);
      onSaved?.();
    } catch {
      // Silent fail for auto-save
    } finally {
      setIsSaving(false);
    }
  }

  async function handleManualSave() {
    setIsSaving(true);
    try {
      await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentEn, contentAr }),
      });
      setHasUnsavedChanges(false);
      toast({ title: "Section saved" });
      onSaved?.();
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  function handleAIDraftGenerated(html: string) {
    if (activeTab === "en") {
      setContentEn(html);
      handleContentChange("en", html);
    } else {
      setContentAr(html);
      handleContentChange("ar", html);
    }
    setIsAiGenerated(true);
    // Also mark in DB
    fetch(`/api/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAiGenerated: true, aiModelUsed: "claude-sonnet-4-6" }),
    }).catch(() => {});
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {sectionLabel}
        </h3>
        {isAiGenerated && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            AI Generated
          </Badge>
        )}
        {hasUnsavedChanges && (
          <span className="text-xs text-amber-500">Unsaved changes</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {hasUnsavedChanges && canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSave}
              disabled={isSaving}
              className="h-7 gap-1.5 text-xs"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </Button>
          )}
          {isSaving && !hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAI(!showAI)}
            className="h-7 gap-1 text-xs text-slate-500"
          >
            AI {showAI ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {canEdit && onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(section.id)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Language tabs */}
      {showArabicTab && (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("en")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "en"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ar")}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              activeTab === "ar"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700"
            )}
            style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
          >
            Arabic
          </button>
        </div>
      )}

      {/* Editor + AI sidebar */}
      <div className={cn("flex gap-4", showAI ? "items-start" : "")}>
        {/* Editor */}
        <div className="flex-1 min-w-0">
          {activeTab === "en" || !showArabicTab ? (
            <TiptapEditor
              content={contentEn}
              onChange={(html) => handleContentChange("en", html)}
              placeholder="Start writing or use AI to generate this section..."
              isRTL={false}
              disabled={!canEdit}
              minHeight={350}
            />
          ) : (
            <TiptapEditor
              content={contentAr}
              onChange={(html) => handleContentChange("ar", html)}
              placeholder="Write here, or use AI to generate this section..."
              isRTL={true}
              disabled={!canEdit}
              minHeight={350}
            />
          )}
        </div>

        {/* AI assistant panel */}
        {showAI && canEdit && (
          <AIAssistantPanel
            sectionId={section.id}
            sectionType={section.sectionType}
            tenderId={tenderId}
            language={activeTab === "ar" ? "AR" : proposalLanguage}
            onDraftGenerated={handleAIDraftGenerated}
            requirements={sectionRequirements as any}
            className="w-64 shrink-0"
          />
        )}
      </div>
    </div>
  );
}
