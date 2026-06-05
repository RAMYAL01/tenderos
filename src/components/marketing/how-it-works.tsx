import { Upload, FileSearch, Brain, Calculator, Target, FileCheck } from "lucide-react";
import { Reveal } from "./reveal";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your RFP",
    description:
      "Drag and drop your tender documents — PDF, DOCX, or scanned. Arabic and English are both supported out of the box.",
  },
  {
    number: "02",
    icon: FileSearch,
    title: "Extract & Map Compliance",
    description:
      "Claude AI reads every requirement, builds a compliance matrix, and flags gaps in your capabilities within minutes.",
  },
  {
    number: "03",
    icon: Brain,
    title: "Draft with Your Knowledge Brain",
    description:
      "Generate technical sections grounded in your own documents — past performance, CVs, certifications — with every claim cited to its source.",
  },
  {
    number: "04",
    icon: Calculator,
    title: "Build the Financial Proposal",
    description:
      "Price the bid from your own rates. Overhead, contingency, profit and VAT are computed deterministically — the AI never invents a price.",
  },
  {
    number: "05",
    icon: Target,
    title: "Optimize to Win",
    description:
      "Get a deterministic win-probability score with pricing-risk analysis and the exact gaps to close before you submit.",
  },
  {
    number: "06",
    icon: FileCheck,
    title: "Export & Submit",
    description:
      "Collaborate in the rich editor, then export a polished, perfectly aligned bilingual proposal to DOCX or PDF.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-20 dark:bg-slate-900/50 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            From RFP to a winning, submitted proposal
          </h2>
        </Reveal>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal as="div" key={step.number} delay={i * 120} className="relative text-center">
                {/* Connector line (desktop only) — not after the last item in a row */}
                {i % 3 !== 2 && i < steps.length - 1 && (
                  <div className="absolute right-0 top-10 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-blue-200 to-transparent lg:block" />
                )}

                <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md shadow-slate-200/50 dark:bg-slate-800 dark:shadow-none">
                  <Icon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="mt-2 text-xs font-bold uppercase tracking-widest text-blue-600">
                  Step {step.number}
                </div>
                <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {step.description}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
