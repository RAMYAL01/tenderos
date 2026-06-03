import {
  FileSearch,
  CheckSquare,
  PenTool,
  Languages,
  Zap,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "AI Requirement Extraction",
    description:
      "Upload any RFP — Arabic or English — and get structured requirements in 90 seconds. Supports PDF, DOCX, and scanned documents.",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    icon: CheckSquare,
    title: "Smart Compliance Matrix",
    description:
      "Auto-map requirements to your capabilities with AI-powered gap analysis. Track compliance status across your entire team.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    icon: PenTool,
    title: "Proposal Generation",
    description:
      "Generate technical proposal sections using Claude AI, calibrated to procurement scoring criteria and your past performance.",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
  {
    icon: Languages,
    title: "Bilingual (AR/EN)",
    description:
      "Full Arabic and English support. Generate proposals in either language, or create bilingual documents for MENA government tenders.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  {
    icon: Zap,
    title: "Content Library",
    description:
      "Store reusable content blocks — past performance, CVs, methodology templates — and let AI find the most relevant content for each bid.",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950",
  },
  {
    icon: Shield,
    title: "Team & Compliance",
    description:
      "Role-based access control, audit logs, and multi-tenant workspaces. Built for enterprise procurement teams with SOC-2 best practices.",
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-slate-100 py-20 dark:border-slate-800 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Everything you need to win more bids
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            From RFP upload to proposal export — TenderOS covers the entire bid
            lifecycle with AI assistance at every step.
          </p>
        </div>

        {/* Feature grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-slate-100 bg-white p-6 transition-all hover:border-slate-200 hover:shadow-lg hover:shadow-slate-100/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none"
              >
                <div
                  className={`inline-flex rounded-xl p-3 ${feature.bg}`}
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
