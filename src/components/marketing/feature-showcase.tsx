"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileSearch,
  CheckSquare,
  PenTool,
  Languages,
  Check,
  Sparkles,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  Calculator,
  Brain,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  {
    key: "extract",
    icon: FileSearch,
    label: "Requirement Extraction",
    blurb:
      "Upload a 400-page RFP — Arabic or English — and TenderOS returns every requirement structured, tagged, and traceable to its source clause in seconds.",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    key: "compliance",
    icon: CheckSquare,
    label: "Compliance Matrix",
    blurb:
      "Each requirement is auto-mapped to your capabilities. AI flags gaps before they cost you the award and tracks status across your whole team.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    key: "knowledge",
    icon: Brain,
    label: "Corporate Knowledge Brain",
    blurb:
      "Ask plain-English questions and get answers grounded only in your own documents — certifications, CVs, past performance — every answer cited back to the source file.",
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950",
  },
  {
    key: "proposal",
    icon: PenTool,
    label: "Proposal Generation",
    blurb:
      "Draft technical sections with Claude AI — grounded in your past performance and calibrated to the tender's scoring criteria.",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
  {
    key: "financial",
    icon: Calculator,
    label: "Financial Proposal Engine",
    blurb:
      "Build a priced commercial proposal from your own rates. Every figure — overhead, contingency, profit, VAT — is computed deterministically. The AI never invents a price. Export to a clean DOCX.",
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-950",
  },
  {
    key: "bilingual",
    icon: Languages,
    label: "Bilingual Output",
    blurb:
      "Generate in Arabic, English, or perfectly aligned side-by-side bilingual documents — formatting and RTL handled automatically.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  {
    key: "optimize",
    icon: Target,
    label: "Bid Optimization",
    blurb:
      "Before you submit, get a deterministic win-probability score — compliance coverage, proposal completeness, pricing risk, and the exact gaps to close. No AI guesswork, just the numbers from your own data.",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950",
  },
] as const;

const AUTO_MS = 5000;

export function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(0);
  const [tick, setTick] = useState(0);

  // Auto-advance with a progress ring
  useEffect(() => {
    if (paused) return;
    startRef.current = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const elapsed = now - startRef.current;
      setTick(Math.min(elapsed / AUTO_MS, 1));
      if (elapsed >= AUTO_MS) {
        setActive((a) => (a + 1) % tabs.length);
        startRef.current = now;
        setTick(0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, active]);

  const select = (i: number) => {
    setActive(i);
    setTick(0);
    startRef.current = performance.now();
  };

  return (
    <section
      className="bg-slate-50/60 py-20 dark:bg-slate-900/30 sm:py-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Product Tour
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            One platform, the entire bid lifecycle
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Click through how TenderOS turns a raw tender into a submitted,
            compliant, winning proposal.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-12">
          {/* Tabs */}
          <div className="flex flex-col gap-3">
            {tabs.map((t, i) => {
              const Icon = t.icon;
              const isActive = i === active;
              return (
                <button
                  key={t.key}
                  onClick={() => select(i)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-5 text-left transition-all",
                    isActive
                      ? "border-blue-200 bg-white shadow-lg shadow-blue-100/50 dark:border-blue-900 dark:bg-slate-900 dark:shadow-none"
                      : "border-transparent bg-white/50 hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("rounded-xl p-2.5 transition-transform", t.bg, isActive && "scale-110")}>
                      <Icon className={cn("h-5 w-5", t.color)} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {t.label}
                      </div>
                      <div
                        className={cn(
                          "grid transition-all duration-300",
                          isActive
                            ? "mt-1 grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                        )}
                      >
                        <p className="overflow-hidden text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                          {t.blurb}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Auto-advance progress bar */}
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-100 dark:bg-blue-950">
                      <div
                        className="h-full bg-blue-600"
                        style={{ width: `${(paused ? 0 : tick) * 100}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview panel */}
          <div className="perspective-1500">
            <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 text-[11px] text-slate-400">
                  {tabs[active].label}
                </span>
              </div>

              {/* Panels */}
              <div className="relative p-5 sm:p-6">
                {active === 0 && <ExtractPanel />}
                {active === 1 && <CompliancePanel />}
                {active === 2 && <KnowledgePanel />}
                {active === 3 && <ProposalPanel />}
                {active === 4 && <FinancialPanel />}
                {active === 5 && <BilingualPanel />}
                {active === 6 && <OptimizePanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Preview panels ── */

function PanelWrap({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in space-y-3">{children}</div>;
}

function ExtractPanel() {
  const reqs = [
    "ISO 9001:2015 quality certification required",
    "Minimum 5 years facilities management experience",
    "Local content ≥ 30% per national policy",
    "24/7 emergency response within 2 hours",
    "Dedicated HSE manager on site",
  ];
  return (
    <PanelWrap>
      <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
        <Sparkles className="h-3.5 w-3.5" /> Extracting requirements…
      </div>
      {reqs.map((r, i) => (
        <div
          key={r}
          className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/30"
          style={{ animation: `fade-in 0.4s ease-out ${i * 0.1}s both` }}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {i + 1}
          </span>
          <span className="text-sm text-slate-700 dark:text-slate-300">{r}</span>
          <span className="ml-auto rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:bg-emerald-950">
            §{3 + i}.{i + 1}
          </span>
        </div>
      ))}
    </PanelWrap>
  );
}

function CompliancePanel() {
  const rows = [
    { r: "ISO 9001 certification", s: "met" },
    { r: "Local content ≥ 30%", s: "met" },
    { r: "24/7 emergency response", s: "progress" },
    { r: "5 years FM experience", s: "met" },
    { r: "Dedicated HSE manager", s: "gap" },
  ];
  return (
    <PanelWrap>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-500">Compliance status</span>
        <span className="font-semibold text-emerald-600">80% covered</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={row.r}
          className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 dark:border-slate-800"
          style={{ animation: `fade-in 0.4s ease-out ${i * 0.08}s both` }}
        >
          <span className="text-sm text-slate-700 dark:text-slate-300">{row.r}</span>
          {row.s === "met" && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Met
            </span>
          )}
          {row.s === "progress" && (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
              <Clock className="h-3.5 w-3.5" /> Drafting
            </span>
          )}
          {row.s === "gap" && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-500">
              <AlertTriangle className="h-3.5 w-3.5" /> Gap
            </span>
          )}
        </div>
      ))}
    </PanelWrap>
  );
}

function ProposalPanel() {
  return (
    <PanelWrap>
      <div className="flex items-center gap-2 text-xs font-medium text-violet-600">
        <Sparkles className="h-3.5 w-3.5" /> Generating Technical Approach…
      </div>
      <div className="rounded-lg border border-slate-100 p-4 dark:border-slate-800">
        <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
          3. Technical Approach
        </div>
        {[
          "Our methodology for the Riyadh Metro Phase 3 facilities contract is",
          "built on a preventive-maintenance framework aligned with ISO 41001,",
          "supported by a 24/7 command centre and a local workforce exceeding",
          "the 30% national content threshold mandated in Section 4.2.",
        ].map((line, i) => (
          <div
            key={i}
            className="h-3 rounded bg-slate-100 dark:bg-slate-800"
            style={{
              width: ["100%", "94%", "97%", "72%"][i],
              marginTop: 8,
              animation: `fade-in 0.5s ease-out ${i * 0.15}s both`,
            }}
          />
        ))}
        <div className="mt-3 inline-flex items-center gap-1 rounded bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-600 dark:bg-violet-950">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
          AI writing…
        </div>
      </div>
    </PanelWrap>
  );
}

function BilingualPanel() {
  return (
    <PanelWrap>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            English
          </div>
          {["100%", "88%", "95%", "70%"].map((w, i) => (
            <div
              key={i}
              className="mt-2 h-2.5 rounded bg-slate-100 dark:bg-slate-800"
              style={{ width: w, animation: `fade-in 0.4s ease-out ${i * 0.1}s both` }}
            />
          ))}
        </div>
        <div className="rounded-lg border border-slate-100 p-3 dark:border-slate-800" dir="rtl">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Arabic
          </div>
          {["100%", "82%", "90%", "65%"].map((w, i) => (
            <div
              key={i}
              className="mt-2 h-2.5 rounded bg-blue-100 dark:bg-blue-950"
              style={{ width: w, animation: `fade-in 0.4s ease-out ${i * 0.1}s both` }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-50 py-2 text-xs text-slate-500 dark:bg-slate-800/40">
        <Languages className="h-3.5 w-3.5 text-amber-600" />
        Synced bilingual export · DOCX &amp; PDF
      </div>
    </PanelWrap>
  );
}

function OptimizePanel() {
  const score = 78;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const metrics = [
    { label: "Compliance", value: 92, display: "92%", color: "bg-emerald-500" },
    { label: "Completeness", value: 85, display: "85%", color: "bg-blue-500" },
    { label: "Pricing risk", value: 22, display: "Low", color: "bg-amber-500" },
  ];
  return (
    <PanelWrap>
      <div className="flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="7"
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              className="text-rose-500"
              stroke="currentColor"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {score}
              <span className="text-sm text-slate-400">%</span>
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
            <TrendingUp className="h-3.5 w-3.5" /> Win probability — Strong
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Scored deterministically from compliance, proposal completeness, your
            priced financials, and historical win rate.
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            style={{ animation: `fade-in 0.4s ease-out ${i * 0.1}s both` }}
          >
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-600 dark:text-slate-300">{m.label}</span>
              <span className="font-medium text-slate-500">{m.display}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn("h-full rounded-full", m.color)}
                style={{ width: `${m.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        2 mandatory gaps to close before submitting
      </div>
    </PanelWrap>
  );
}

function KnowledgePanel() {
  const sources = ["ISO 9001 Certificate.pdf", "Company Profile 2024", "QHSE Manual"];
  return (
    <PanelWrap>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
        <Brain className="h-4 w-4 shrink-0 text-cyan-500" />
        <span className="text-xs text-slate-700 dark:text-slate-300">
          What ISO certifications do we hold?
        </span>
        <Sparkles className="ml-auto h-3.5 w-3.5 shrink-0 text-cyan-500" />
      </div>
      <div
        className="rounded-lg border border-slate-100 bg-white p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        style={{ animation: "fade-in 0.5s ease-out both" }}
      >
        Your company holds{" "}
        <span className="font-semibold text-slate-900 dark:text-white">ISO 9001:2015</span>,{" "}
        <span className="font-semibold text-slate-900 dark:text-white">ISO 14001</span>, and{" "}
        <span className="font-semibold text-slate-900 dark:text-white">ISO 45001</span> — all
        current and verified in your uploaded certificates.
      </div>
      <div>
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          Sources
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              style={{ animation: `fade-in 0.4s ease-out ${0.25 + i * 0.1}s both` }}
            >
              <FileText className="h-2.5 w-2.5 text-cyan-500" /> {s}
            </span>
          ))}
        </div>
      </div>
    </PanelWrap>
  );
}

function FinancialPanel() {
  const rows = [
    { label: "Direct cost", value: "SAR 274,000", bold: true },
    { label: "Overhead (10%)", value: "27,400" },
    { label: "Contingency (5%)", value: "15,070" },
    { label: "Profit (12%)", value: "37,976" },
    { label: "VAT (15%)", value: "53,167" },
  ];
  return (
    <PanelWrap>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-teal-600">
          <Calculator className="h-3.5 w-3.5" /> Deterministic cost build-up
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-400">
          <ShieldCheck className="h-3 w-3" /> No AI pricing
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className="flex items-center justify-between border-b border-slate-50 px-3 py-2 last:border-0 dark:border-slate-800/60"
            style={{ animation: `fade-in 0.4s ease-out ${i * 0.08}s both` }}
          >
            <span
              className={cn(
                "text-xs text-slate-600 dark:text-slate-300",
                r.bold && "font-semibold text-slate-900 dark:text-white"
              )}
            >
              {r.label}
            </span>
            <span
              className={cn(
                "font-mono text-xs text-slate-500",
                r.bold && "font-semibold text-slate-900 dark:text-white"
              )}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2.5 text-white dark:bg-blue-600">
        <span className="text-xs font-semibold">Total price (incl. VAT)</span>
        <span className="font-mono text-sm font-bold">SAR 407,613</span>
      </div>
    </PanelWrap>
  );
}
