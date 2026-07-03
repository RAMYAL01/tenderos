"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2, Sparkles, RotateCcw, ChevronDown, AlertTriangle, Target, Truck, Coins, Handshake, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAIJob } from "@/hooks/use-ai-job";

export interface CommercialModelData {
  summary: string;
  content: {
    deliveryApproach?: string;
    pricingStrategy?: string;
    partnering?: string;
    commercialTerms?: { item: string; position: string }[];
    risks?: { title: string; severity: "HIGH" | "MEDIUM" | "LOW"; mitigation: string }[];
    winThemes?: string[];
  };
}

const SEV_CLS: Record<string, string> = { HIGH: "text-red-600", MEDIUM: "text-amber-600", LOW: "text-slate-500" };

function Prose({ icon: Icon, title, text }: { icon: typeof Truck; title: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
    </div>
  );
}

export function CommercialModelCard({
  tenderId,
  model,
  canRun,
}: {
  tenderId: string;
  model: CommercialModelData | null;
  canRun: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const { run, isRunning, state } = useAIJob({
    onComplete: () => {
      toast({ title: "Commercial model ready" });
      router.refresh();
    },
    onError: (e) => toast({ title: "Generation failed", description: e, variant: "destructive" }),
  });

  function generate() {
    void run(() =>
      fetch("/api/ai/commercial-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenderId }),
      })
    );
  }

  const header = (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Commercial Model</h3>
      </div>
      {model && canRun && (
        <button
          type="button"
          onClick={generate}
          disabled={isRunning}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          title="Regenerate (1 credit)"
        >
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );

  // ── No model yet ──────────────────────────────────────────────────────────
  if (!model) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {header}
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          Generate the bid&rsquo;s commercial approach — delivery, pricing strategy, partnering, terms, risks, and win
          themes — grounded in your Knowledge Brain and the market benchmark.
        </p>
        {canRun ? (
          <Button size="sm" className="w-full" onClick={generate} disabled={isRunning}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isRunning ? `Generating… ${state.progress}%` : "Generate commercial model (1 credit)"}
          </Button>
        ) : (
          <p className="text-xs text-slate-400">A Writer or above can generate it.</p>
        )}
      </div>
    );
  }

  const c = model.content;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {header}

      <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{model.summary}</p>

      {c.winThemes && c.winThemes.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <Target className="h-3 w-3 text-emerald-500" /> Win themes
          </p>
          <div className="flex flex-wrap gap-1">
            {c.winThemes.map((w, i) => (
              <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mb-2 flex w-full items-center justify-between text-xs font-medium text-blue-600 hover:text-blue-700"
      >
        {expanded ? "Hide full model" : "Read full model"}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
          <Prose icon={Truck} title="Delivery approach" text={c.deliveryApproach} />
          <Prose icon={Coins} title="Pricing strategy" text={c.pricingStrategy} />
          <Prose icon={Handshake} title="Partnering & subcontracting" text={c.partnering} />

          {c.commercialTerms && c.commercialTerms.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-3.5 w-3.5" /> Commercial terms
              </p>
              <ul className="space-y-1">
                {c.commercialTerms.map((t, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{t.item}:</span> {t.position}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {c.risks && c.risks.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <AlertTriangle className="h-3.5 w-3.5" /> Commercial risks
              </p>
              <ul className="space-y-1">
                {c.risks.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <AlertTriangle className={cn("mt-0.5 h-3 w-3 shrink-0", SEV_CLS[r.severity])} />
                    <span>
                      <span className="font-medium">{r.title}.</span> {r.mitigation}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
