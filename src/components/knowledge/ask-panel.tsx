"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Source {
  id: string;
  title: string;
  type: string;
  score: number;
}

const EXAMPLES = [
  "What ISO certifications do we hold?",
  "What similar projects have we completed in Saudi Arabia?",
  "Show all projects involving power generation.",
  "Summarize our facilities management experience.",
];

export function AskPanel({ hasKnowledge }: { hasKnowledge: boolean }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const res = await fetch("/api/knowledge/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(error ?? "Request failed");
      }
      const data = await res.json();
      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Ask your Knowledge Brain
          </h3>
          <p className="text-xs text-slate-500">
            Answers come only from your uploaded company documents.
          </p>
        </div>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What ISO certifications do we hold?"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
        />
        <Button type="submit" disabled={loading || !question.trim()} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </Button>
      </form>

      {/* Example chips */}
      {!answer && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex);
                ask(ex);
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {!hasKnowledge && !answer && (
        <p className="mt-3 text-xs text-amber-600">
          Your knowledge base is empty — add documents below so the brain has
          something to answer from.
        </p>
      )}

      {/* Answer */}
      {loading && (
        <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching your documents…
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-200">
            <p className="whitespace-pre-wrap">{answer}</p>
          </div>
          {sources.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <FileText className="h-3 w-3 text-blue-500" />
                    {s.title}
                    <span className="text-slate-400">· {Math.round(s.score * 100)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
