import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.08), transparent)",
        }}
      />

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:pt-32">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            AI-Powered Proposal Intelligence
          </div>

          {/* Headline */}
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            The Operating System for{" "}
            <span className="text-blue-600">Winning Contracts</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            Upload any RFP — Arabic or English — and TenderOS extracts
            requirements, builds compliance matrices, and generates winning
            proposals with AI. Built for government contractors, EPC firms, and
            defense companies.
          </p>

          {/* Arabic tagline */}
          <p
            className="mx-auto mt-3 max-w-lg font-arabic text-sm text-slate-400"
            dir="rtl"
            lang="ar"
          >
            حمّل أي مناقصة — بالعربية أو الإنجليزية — واحصل على عروض فنية
            جاهزة للفوز بالذكاء الاصطناعي
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="h-12 gap-2 px-8 text-sm" asChild>
              <Link href="/sign-up">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 gap-2 px-8 text-sm"
              asChild
            >
              <Link href="#features">
                <Play className="h-4 w-4" />
                See How It Works
              </Link>
            </Button>
          </div>

          <p className="mt-4 text-xs text-slate-400">
            14-day free trial. No credit card required.
          </p>
        </div>

        {/* Hero image — dashboard screenshot */}
        <div className="relative mt-16">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xl shadow-blue-500/10 dark:border-slate-700 dark:bg-slate-800">
            {/* Placeholder — replace with actual dashboard screenshot */}
            <div className="aspect-[16/9] w-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                Dashboard Preview
              </div>
            </div>
          </div>
          {/* Fade-out at bottom */}
          <div className="pointer-events-none absolute -bottom-1 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-slate-950" />
        </div>
      </div>
    </section>
  );
}
