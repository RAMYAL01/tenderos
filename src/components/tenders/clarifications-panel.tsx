"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { HelpCircle, Loader2, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAIJob } from "@/hooks/use-ai-job";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Question {
  number: number;
  section_ref: string;
  question_en: string;
  question_ar: string | null;
  reason: string;
}

interface ClarificationsPanelProps {
  tenderId: string;
  questions: Question[];
  lastGeneratedAt: Date | null;
}

export function ClarificationsPanel({
  tenderId,
  questions: initialQuestions,
  lastGeneratedAt,
}: ClarificationsPanelProps) {
  const router = useRouter();
  const [questions, setQuestions] = React.useState(initialQuestions);

  const { run, state, isRunning } = useAIJob({
    onComplete: (result) => {
      const r = result as { questions?: Question[] } | null;
      if (r?.questions) {
        setQuestions(r.questions);
        toast({ title: `${r.questions.length} clarification questions generated ✓` });
        router.refresh();
      }
    },
    onError: (error) => {
      toast({ title: "Generation failed", description: error, variant: "destructive" });
    },
  });

  function handleGenerate() {
    run(() =>
      fetch("/api/ai/clarification-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId }),
      })
    );
  }

  function handleDownloadTxt() {
    const text = questions
      .map(
        (q) =>
          `Q${q.number}. ${q.section_ref ? `[${q.section_ref}]` : ""}\n${q.question_en}\n${q.question_ar ? `\n(AR) ${q.question_ar}` : ""}\nReason: ${q.reason}`
      )
      .join("\n\n---\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clarification-questions.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={isRunning} className="gap-2">
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <HelpCircle className="h-4 w-4" />
          )}
          {questions.length > 0 ? "Regenerate" : "Generate"} Clarification Questions
        </Button>

        {questions.length > 0 && (
          <Button variant="outline" onClick={handleDownloadTxt} className="gap-2">
            <Download className="h-4 w-4" />
            Download TXT
          </Button>
        )}

        {lastGeneratedAt && !isRunning && (
          <span className="text-xs text-slate-500">
            Last generated: {format(new Date(lastGeneratedAt), "d MMM yyyy, HH:mm")}
          </span>
        )}
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/10 dark:text-blue-400">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Analyzing tender requirements and generating clarification questions... ({state.progress}%)
        </div>
      )}

      {/* Empty state */}
      {questions.length === 0 && !isRunning && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-20 text-center dark:border-slate-700">
          <HelpCircle className="mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600 dark:text-slate-400">No clarification questions yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Extract requirements first, then generate questions based on ambiguities
          </p>
        </div>
      )}

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>{questions.length}</strong> clarification questions ready for submission.
            Review and edit before sending to the client.
          </p>
          {questions.map((q) => (
            <div
              key={q.number}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                  Q{q.number}
                </span>
                <div className="min-w-0 flex-1">
                  {q.section_ref && (
                    <p className="mb-1 text-xs font-medium text-slate-500">{q.section_ref}</p>
                  )}
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {q.question_en}
                  </p>
                  {q.question_ar && (
                    <p
                      className="mt-1 text-sm text-slate-700 dark:text-slate-300"
                      dir="rtl"
                      style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
                    >
                      {q.question_ar}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">{q.reason}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Need React import for useState
import React from "react";
