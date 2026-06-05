import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { Reveal } from "@/components/marketing/reveal";
import { AnimatedCounter } from "@/components/marketing/animated-counter";
import { Button } from "@/components/ui/button";
import {
  Target,
  Globe2,
  Sparkles,
  ShieldCheck,
  Heart,
  Zap,
  ArrowRight,
} from "lucide-react";

export const metadata = {
  title: "About",
  description:
    "TenderOS is on a mission to help government contractors across MENA win more bids with AI-powered, bilingual proposal intelligence.",
};

const values = [
  {
    icon: Target,
    title: "Win-rate obsessed",
    desc: "Every feature is measured against one question: does it help our customers win more contracts?",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
  },
  {
    icon: Globe2,
    title: "Bilingual by design",
    desc: "Arabic and English are first-class citizens — not an afterthought bolted on for a regional market.",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  {
    icon: ShieldCheck,
    title: "Trust above all",
    desc: "Procurement data is sensitive. We treat security and confidentiality as non-negotiable foundations.",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
  {
    icon: Zap,
    title: "Speed compounds",
    desc: "Shaving weeks off every bid lets our customers pursue more opportunities — and that compounds.",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  {
    icon: Heart,
    title: "Customer-led",
    desc: "We build alongside bid teams in the field, shipping what they actually need, not what we assume.",
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-950",
  },
  {
    icon: Sparkles,
    title: "AI with judgment",
    desc: "We pair frontier models with deep procurement context so the output is credible, not generic.",
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950",
  },
];

const stats = [
  { value: 200, suffix: "+", label: "Proposals generated" },
  { value: 50, suffix: "+", label: "Contractors onboarded" },
  { value: 30, suffix: "%", label: "Faster submissions" },
  { value: 2, suffix: "", label: "Languages, native" },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(59,130,246,0.1), transparent)",
            }}
          />
          <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Our Mission
              </p>
              <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
                Helping contractors win the work that{" "}
                <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                  builds nations
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                Government tenders move economies — but winning them is slow,
                manual, and unforgiving. TenderOS gives bid teams an AI-powered
                operating system to extract requirements, prove compliance, and
                write winning proposals in Arabic and English, in a fraction of
                the time.
              </p>            </Reveal>
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-slate-100 bg-slate-50/60 py-14 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-4 sm:px-6 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 80} className="text-center">
                <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
                  <AnimatedCounter value={s.value} suffix={s.suffix} />
                </div>
                <div className="mt-2 text-sm text-slate-500">{s.label}</div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Story */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <Reveal>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                Our Story
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Born on the bid desk
              </h2>
              <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
                <p>
                  TenderOS started with a frustration every bid manager in the
                  Gulf knows too well: a 400-page RFP lands on a Thursday, the
                  submission is due in twelve days, and half of it is in Arabic.
                  Requirements get missed. Compliance matrices are built by hand
                  in spreadsheets. Proposal writers reinvent the same content for
                  the hundredth time.
                </p>
                <p>
                  We believed AI could change that — not by replacing expert bid
                  teams, but by removing the manual, repetitive work that buries
                  them. So we built an operating system around the entire bid
                  lifecycle: extract every requirement automatically, map it to
                  your capabilities, surface gaps before they cost you the award,
                  and draft strong technical sections grounded in your own past
                  performance.
                </p>
                <p>
                  Today, contractors across construction, facilities management,
                  defense, and infrastructure use TenderOS to submit better
                  proposals, faster — and to pursue opportunities they would have
                  had to walk away from before.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Values */}
        <section className="bg-slate-50/60 py-20 dark:bg-slate-900/30 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                What We Believe
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                The principles behind the product
              </h2>
            </Reveal>

            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {values.map((v, i) => {
                const Icon = v.icon;
                return (
                  <Reveal key={v.title} delay={i * 70}>
                    <div className="h-full rounded-2xl border border-slate-100 bg-white p-7 transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                      <div className={`inline-flex rounded-xl p-3 ${v.bg}`}>
                        <Icon className={`h-6 w-6 ${v.color}`} />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                        {v.title}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                        {v.desc}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-28">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Reveal>
              <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-[#0c1a35] px-6 py-16 text-center shadow-2xl shadow-blue-600/20 sm:px-12">
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Join the teams winning with TenderOS
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
                  Start your 14-day free trial, or talk to us about your bid
                  pipeline.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    className="group h-12 gap-2 bg-white px-8 text-sm text-blue-700 hover:bg-blue-50"
                    asChild
                  >
                    <Link href="/sign-up">
                      Start Free Trial
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 border-white/30 px-8 text-sm text-white hover:bg-white/10 hover:text-white"
                    asChild
                  >
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
