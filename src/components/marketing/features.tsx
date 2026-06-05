import {
  FileSearch,
  CheckSquare,
  Brain,
  PenTool,
  Calculator,
  Target,
  Languages,
  ShieldCheck,
} from "lucide-react";
import { Reveal } from "./reveal";
import { TiltCard } from "./tilt-card";

const features = [
  {
    icon: FileSearch,
    title: "AI Requirement Extraction",
    description:
      "Upload any RFP — Arabic or English, even scanned — and get every requirement structured and tagged in 90 seconds.",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/60",
    ring: "group-hover:ring-blue-200 dark:group-hover:ring-blue-900",
    span: "lg:col-span-2",
    accent: true,
  },
  {
    icon: CheckSquare,
    title: "Smart Compliance Matrix",
    description:
      "Auto-map requirements to your capabilities with AI gap analysis.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    ring: "group-hover:ring-emerald-200 dark:group-hover:ring-emerald-900",
    span: "",
  },
  {
    icon: Brain,
    title: "Corporate Knowledge Brain",
    description:
      "Ask plain-English questions and get answers grounded only in your own documents — each one cited to its source file.",
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/60",
    ring: "group-hover:ring-cyan-200 dark:group-hover:ring-cyan-900",
    span: "",
  },
  {
    icon: PenTool,
    title: "Proposal Generation",
    description:
      "Draft technical sections with Claude AI, calibrated to scoring criteria.",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/60",
    ring: "group-hover:ring-violet-200 dark:group-hover:ring-violet-900",
    span: "",
  },
  {
    icon: Calculator,
    title: "Financial Proposal Engine",
    description:
      "Price the bid from your own rates — overhead, contingency, profit and VAT computed deterministically. The AI never invents a price.",
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-950/60",
    ring: "group-hover:ring-teal-200 dark:group-hover:ring-teal-900",
    span: "",
  },
  {
    icon: Target,
    title: "Bid Optimization",
    description:
      "A deterministic win-probability score with pricing-risk and the exact gaps to close before you submit.",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950/60",
    ring: "group-hover:ring-rose-200 dark:group-hover:ring-rose-900",
    span: "",
  },
  {
    icon: Languages,
    title: "Truly Bilingual",
    description:
      "Generate in Arabic, English, or side-by-side bilingual documents for MENA government tenders.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/60",
    ring: "group-hover:ring-amber-200 dark:group-hover:ring-amber-900",
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Security",
    description:
      "Role-based access, audit logs, encrypted storage, and isolated multi-tenant workspaces.",
    color: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/60",
    ring: "group-hover:ring-indigo-200 dark:group-hover:ring-indigo-900",
    span: "",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Everything you need to win more bids
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            From RFP upload to final export — AI assistance at every step of the
            bid lifecycle.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={i * 70} className={feature.span}>
                <TiltCard
                  max={8}
                  scale={1.03}
                  glareColor="rgba(59,130,246,0.12)"
                  className={`group h-full rounded-2xl ${feature.ring}`}
                >
                  <div
                    className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition-shadow duration-300 group-hover:shadow-2xl group-hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:shadow-blue-950/30"
                  >
                    {/* Decorative gradient blob for accent cards */}
                    {feature.accent && (
                      <div
                        className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${feature.color}`}
                        style={{ background: "radial-gradient(circle, currentColor, transparent)" }}
                      />
                    )}
                    <div
                      className={`inline-flex w-fit rounded-xl p-3 transition-transform duration-300 group-hover:scale-110 ${feature.bg}`}
                    >
                      <Icon className={`h-6 w-6 ${feature.color}`} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
