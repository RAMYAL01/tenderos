import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Star } from "lucide-react";
import { HeroMockup } from "./hero-mockup";
import { Reveal } from "./reveal";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Aurora mesh background */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div
          className="animate-aurora absolute left-1/4 top-[-10%] h-[500px] w-[500px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%)" }}
        />
        <div
          className="animate-aurora absolute right-1/4 top-[5%] h-[420px] w-[420px] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.2), transparent 70%)", animationDelay: "6s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.4] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000, transparent)",
          }}
        />
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <Reveal>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-4 py-1.5 text-xs font-medium text-blue-700 backdrop-blur dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Powered by Claude AI · Arabic & English
            </div>
          </Reveal>

          {/* Headline */}
          <Reveal delay={80}>
            <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl">
              The Operating System for{" "}
              <span className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent">
                Winning Contracts
              </span>
            </h1>
          </Reveal>

          {/* Subtitle */}
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Upload any RFP — Arabic or English — and TenderOS extracts every
              requirement, builds your compliance matrix, and drafts winning
              proposals with AI. Purpose-built for government contractors, EPC
              firms, and defense companies.
            </p>
            <p
              className="mx-auto mt-3 max-w-lg font-arabic text-sm text-slate-400"
              dir="rtl"
              lang="ar"
            >
              حمّل أي مناقصة بالعربية أو الإنجليزية واحصل على عروض فنية جاهزة للفوز
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal delay={240}>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="group h-12 gap-2 px-8 text-sm shadow-lg shadow-blue-600/20"
                asChild
              >
                <Link href="/sign-up">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 gap-2 px-8 text-sm"
                asChild
              >
                <Link href="#how-it-works">
                  <Play className="h-4 w-4" />
                  See How It Works
                </Link>
              </Button>
            </div>

            {/* Trust line */}
            <div className="mt-6 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 sm:flex-row sm:gap-4">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 font-medium">4.8/5 pilot rating</span>
              </div>
              <span className="hidden sm:inline">·</span>
              <span>14-day free trial · No credit card required</span>
            </div>
          </Reveal>
        </div>

        {/* Product mockup */}
        <Reveal delay={320} className="mx-auto mt-16 max-w-4xl">
          <HeroMockup />
        </Reveal>
      </div>
    </section>
  );
}
