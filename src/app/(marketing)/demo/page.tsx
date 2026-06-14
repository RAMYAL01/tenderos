import Link from "next/link";
import {
  Sparkles, Building2, Globe2, CalendarClock, Banknote, FileText,
  CheckCircle2, AlertTriangle, HelpCircle, ArrowRight, ShieldCheck, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_TENDER, SAMPLE_REQUIREMENTS, SAMPLE_BID, SAMPLE_SECTIONS, FACTOR_LABELS,
} from "@/lib/demo/sample-content";
import { CaptureEvent } from "@/components/providers/analytics-capture";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

export const metadata = {
  title: "Live Demo — Watch TenderOS analyze a real tender",
  description:
    "See TenderOS turn a 128-page government RFP into a bid decision, compliance matrix, and proposal draft — no signup, no upload.",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: "Addressed", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
  IN_PROGRESS: { label: "In progress", cls: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" },
  FLAGGED: { label: "Flagged", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
  NOT_STARTED: { label: "To do", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};
const SEVERITY: Record<string, string> = { high: "text-red-600", medium: "text-amber-600", low: "text-slate-500" };
const PRIORITY: Record<string, string> = { CRITICAL: "text-red-600", HIGH: "text-amber-600", MEDIUM: "text-slate-500" };

function SignupCta({ label = "Start free", className }: { label?: string; className?: string }) {
  return (
    <Button asChild className={className}>
      <Link href="/sign-up">{label} <ArrowRight className="h-4 w-4" /></Link>
    </Button>
  );
}

export default function DemoPage() {
  const pct = Math.round(SAMPLE_BID.score * 100);
  const coverage = Math.round(
    (SAMPLE_REQUIREMENTS.filter((r) => r.status === "COMPLETED").length / SAMPLE_REQUIREMENTS.length) * 100
  );

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      <CaptureEvent event={ANALYTICS_EVENTS.PUBLIC_DEMO_VIEWED} />

      {/* Demo bar */}
      <div className="border-b border-blue-200/60 bg-blue-600 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 font-medium">
            <Sparkles className="h-4 w-4" /> You&apos;re viewing a live demo — real output, no signup
          </span>
          <Link href="/sign-up" className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">
            Do this with your own tender <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            One 128-page RFP. <span className="text-blue-600">90 seconds.</span> A bid decision.
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            This is exactly what TenderOS produced from the tender below — requirements extracted, a compliance
            matrix, an AI bid/no-bid score, and a draft proposal. Scroll through it, then try it on yours.
          </p>
        </div>

        {/* Tender header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
                <FileText className="h-3.5 w-3.5" /> {SAMPLE_TENDER.referenceNo}
              </p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{SAMPLE_TENDER.titleEn}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5"><Building2 className="h-4 w-4" />{SAMPLE_TENDER.clientName}</span>
                <span className="inline-flex items-center gap-1.5"><Globe2 className="h-4 w-4" />Saudi Arabia</span>
                <span className="inline-flex items-center gap-1.5"><Banknote className="h-4 w-4" />SAR 450M</span>
                <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4" />Closes in {SAMPLE_TENDER.deadlineDays} days</span>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Construction · RFP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bid qualification */}
        <Section icon={ShieldCheck} title="AI Bid / No-Bid qualification" sub="Win-probability scored against your capability profile and history.">
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-xl bg-emerald-50 p-5 text-center dark:bg-emerald-950/30">
              <div className="text-5xl font-bold text-emerald-600">{pct}%</div>
              <div className="mt-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">BID</div>
              <div className="mt-2 text-xs text-slate-500">win probability</div>
            </div>
            <div className="space-y-2.5">
              {Object.entries(SAMPLE_BID.factors).map(([k, v]) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-slate-600 dark:text-slate-300">{FACTOR_LABELS[k] ?? k}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.round((v as number) * 100)}%` }} />
                  </div>
                  <span className="w-9 text-right text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">{Math.round((v as number) * 100)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            {SAMPLE_BID.rationale}
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><AlertTriangle className="h-4 w-4 text-amber-500" /> Key risks</h4>
              <ul className="space-y-2">
                {SAMPLE_BID.risks.map((r) => (
                  <li key={r.title} className="text-sm">
                    <span className={`font-medium ${SEVERITY[r.severity]}`}>{r.title}</span>
                    <span className="text-slate-500"> — {r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200"><HelpCircle className="h-4 w-4 text-blue-500" /> Questions to clarify</h4>
              <ul className="space-y-2">
                {SAMPLE_BID.questions.map((q) => (
                  <li key={q} className="text-sm text-slate-600 dark:text-slate-300">{q}</li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Requirements & compliance */}
        <Section icon={Layers} title="Requirements & compliance matrix" sub={`${SAMPLE_REQUIREMENTS.length} requirements auto-extracted from the RFP · ${coverage}% addressed`}>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50">
                <tr><th className="px-4 py-2.5 font-medium">Requirement</th><th className="px-4 py-2.5 font-medium">Priority</th><th className="px-4 py-2.5 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {SAMPLE_REQUIREMENTS.map((r) => (
                  <tr key={r.sectionRef} className="align-top">
                    <td className="px-4 py-3">
                      <p className="text-slate-800 dark:text-slate-100">{r.textEn}</p>
                      <p className="mt-0.5 text-xs text-slate-400">§{r.sectionRef} · p.{r.pageRef}{r.type === "OPTIONAL" ? " · optional" : ""}</p>
                      {r.responseEn && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ {r.responseEn}</p>}
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs font-medium ${PRIORITY[r.priority]}`}>{r.priority}</span></td>
                    <td className="px-4 py-3"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Proposal draft */}
        <Section icon={FileText} title="AI-drafted proposal" sub="Compliant sections, written from your knowledge base.">
          <div className="space-y-5">
            {SAMPLE_SECTIONS.map((s) => (
              <div key={s.type} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><Sparkles className="h-3 w-3" /> AI-generated</span>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{s.titleEn}</h4>
                </div>
                {s.contentEn.split("\n\n").map((para, i) => (
                  <p key={i} className="mb-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{para}</p>
                ))}
              </div>
            ))}
          </div>
        </Section>

        {/* Final CTA */}
        <div className="mt-12 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white">
          <h3 className="text-2xl font-bold">That took TenderOS about 90 seconds.</h3>
          <p className="mx-auto mt-2 max-w-xl text-blue-100">
            Do it with your own tender — upload an RFP and get the same requirements, compliance matrix, bid score, and
            proposal draft. Free to start, no card required.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="bg-white text-blue-700 hover:bg-blue-50">
              <Link href="/sign-up">Start free <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              <Link href="/contact">Book a demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, sub, children }: { icon: typeof FileText; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm text-slate-500">{sub}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">{children}</div>
    </section>
  );
}
