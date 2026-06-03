"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "What file types does TenderOS support?",
    a: "PDF, DOCX, DOC, and TXT files up to 50 MB. We also handle scanned PDFs using OCR, so even image-based government tenders work out of the box.",
  },
  {
    q: "Does it support Arabic?",
    a: "Yes — full bilingual support. TenderOS extracts requirements, generates proposal sections, and exports documents in both Arabic and English. You can even create bilingual proposals for MENA government tenders.",
  },
  {
    q: "How does AI proposal generation work?",
    a: "TenderOS uses Anthropic Claude, one of the most capable AI models for professional writing. It reads your RFP requirements, references your content library of past performance and methodology, and generates draft proposal sections calibrated to procurement scoring criteria.",
  },
  {
    q: "Is my data secure?",
    a: "Your documents are encrypted in transit (TLS 1.3) and at rest (AES-256 via AWS S3). Each organization's data is fully isolated. We use Clerk for enterprise-grade authentication with SOC 2 Type II compliance. We never use your data to train AI models.",
  },
  {
    q: "Can I export proposals to Word or PDF?",
    a: "Yes. Export to DOCX (Microsoft Word) or PDF with full formatting, headers, footers, and bilingual layouts. Enterprise plans also support custom branded templates.",
  },
  {
    q: "How many team members can use TenderOS?",
    a: "Starter plan includes 3 seats, Professional includes 10, and Business includes 30. Enterprise plans have unlimited seats. Each member gets their own login with role-based permissions.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — every plan includes a 14-day free trial with full access to all features. No credit card required to start.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-400">
            Everything you need to know. Can&apos;t find an answer?{" "}
            <a href="mailto:hello@tenderos.ai" className="font-medium text-blue-600 hover:underline">
              Email us
            </a>
            .
          </p>
        </div>

        {/* Accordion */}
        <div className="mt-12 divide-y divide-slate-200 dark:divide-slate-700">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="py-5">
                <button
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-200",
                    isOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
