"use client";

import { useState, useRef } from "react";
import {
  Sparkles, Loader2, ChevronDown, ChevronUp, BookOpen,
  CheckCircle2, Circle, RefreshCw, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { SectionType, RequirementPriority } from "@prisma/client";

interface RequirementItem {
  id: string;
  textEn: string | null;
  priority: RequirementPriority;
  isAddressed: boolean;
}

interface AIAssistantPanelProps {
  sectionId: string;
  sectionType: SectionType;
  tenderId: string;
  language: string;
  onDraftGenerated: (text: string) => void;
  requirements?: RequirementItem[];
  className?: string;
}

const TONE_OPTIONS = [
  { value: "formal_government", label: "Formal Government" },
  { value: "technical", label: "Technical" },
  { value: "professional", label: "Professional" },
  { value: "concise", label: "Concise" },
];

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "AR", label: "Arabic (عربي)" },
  { value: "BILINGUAL", label: "Bilingual" },
];

export function AIAssistantPanel({
  sectionId,
  sectionType,
  tenderId,
  language,
  onDraftGenerated,
  requirements = [],
  className,
}: AIAssistantPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedTone, setSelectedTone] = useState("formal_government");
  const [additionalContext, setAdditionalContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleGenerate(mode: "replace" | "append" = "replace") {
    if (isGenerating) {
      abortRef.current?.abort();
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    setStreamedText("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/ai/draft-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          sectionType,
          tenderId,
          language: selectedLanguage,
          tone: selectedTone,
          additionalContext: additionalContext || undefined,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              setStreamedText(fullText);
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch {}
        }
      }

      if (fullText) {
        // Convert plain text to basic HTML paragraphs
        const html = textToHtml(fullText);
        onDraftGenerated(html);
        toast({ title: "Draft generated ✓" });
      }
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      toast({
        title: "Generation failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }

  function textToHtml(text: string): string {
    // Detect Arabic version marker
    const hasArabic = text.includes("[ARABIC_VERSION]");
    if (hasArabic) {
      const [enPart, arPart] = text.split("[ARABIC_VERSION]");
      return paragraphsToHtml(enPart.trim()) +
        `<hr><div dir="rtl" style="font-family:'IBM Plex Sans Arabic',sans-serif">` +
        paragraphsToHtml(arPart?.trim() ?? "") +
        `</div>`;
    }
    return paragraphsToHtml(text);
  }

  function paragraphsToHtml(text: string): string {
    return text
      .split(/\n\n+/)
      .map((para) => {
        const trimmed = para.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("#")) {
          const level = trimmed.match(/^(#+)/)?.[1].length ?? 2;
          const content = trimmed.replace(/^#+\s*/, "");
          return `<h${Math.min(level, 3)}>${content}</h${Math.min(level, 3)}>`;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const items = trimmed.split("\n").map((li) =>
            li.replace(/^[-•]\s*/, "").trim()
          ).filter(Boolean);
          return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
        }
        return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
      })
      .filter(Boolean)
      .join("");
  }

  async function handleCopy() {
    if (!streamedText) return;
    await navigator.clipboard.writeText(streamedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const addressedCount = requirements.filter((r) => r.isAddressed).length;

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            AI Assistant
          </p>
          <p className="text-[10px] text-slate-500">Claude 3.5 Sonnet</p>
        </div>
      </div>

      {/* Language + Tone */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Language</Label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((l) => (
                <SelectItem key={l.value} value={l.value} className="text-xs">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tone</Label>
          <Select value={selectedTone} onValueChange={setSelectedTone}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Additional context toggle */}
      <button
        type="button"
        onClick={() => setShowContext(!showContext)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        {showContext ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Add instructions
      </button>

      {showContext && (
        <Textarea
          placeholder="e.g. Focus on our experience with healthcare projects in Saudi Arabia..."
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          className="min-h-20 resize-none text-xs"
        />
      )}

      {/* Generate button */}
      <Button
        onClick={() => handleGenerate("replace")}
        className={cn("w-full gap-2", isGenerating && "bg-red-600 hover:bg-red-700")}
        size="sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Stop generating
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Draft
          </>
        )}
      </Button>

      {/* Live streaming preview */}
      {isGenerating && streamedText && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-6">
            {streamedText}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin text-blue-500" />
            <span className="text-[10px] text-blue-500">Writing...</span>
          </div>
        </div>
      )}

      {/* Copy button after generation */}
      {!isGenerating && streamedText && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="w-full gap-2"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy text"}
        </Button>
      )}

      {/* Requirements coverage */}
      {requirements.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Requirements
            </span>
            <span className="text-xs text-slate-500">
              {addressedCount}/{requirements.length}
            </span>
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {requirements.slice(0, 8).map((req) => (
              <div key={req.id} className="flex items-start gap-1.5">
                {req.isAddressed ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
                )}
                <span className="line-clamp-1 text-[10px] text-slate-600 dark:text-slate-400">
                  {req.textEn}
                </span>
              </div>
            ))}
            {requirements.length > 8 && (
              <p className="text-[10px] text-slate-400">
                +{requirements.length - 8} more
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
