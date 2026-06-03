import { Upload, Brain, FileCheck } from "lucide-react";
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
    icon: Brain,
    title: "AI Extracts & Analyzes",
    description:
      "Claude AI reads every requirement, builds a compliance matrix, and identifies gaps in your capabilities within minutes.",
  },
  {
    number: "03",
    icon: FileCheck,
    title: "Generate & Submit",
    description:
      "Draft technical sections with AI, collaborate with your team in the rich editor, and export to DOCX or PDF when ready.",
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
            From RFP to proposal in three steps
          </h2>
        </Reveal>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-8">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal as="div" key={step.number} delay={i * 120} className="relative text-center">
                {/* Connector line (desktop only) */}
                {i < steps.length - 1 && (
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
