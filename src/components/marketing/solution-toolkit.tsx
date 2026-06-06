/**
 * Reusable section toolkit for solution / programmatic SEO pages.
 * Presentational server components composed from the existing marketing kit.
 */

import Link from "next/link";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";
import { Reveal } from "./reveal";
import { ShinyButton } from "./shiny-button";

export function SolutionShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}

/** Inline JSON-LD. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function SolutionHero({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
}) {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(37,99,235,0.12), transparent)" }}
      />
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ShinyButton href="/sign-up" variant="primary" size="lg">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </ShinyButton>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 px-7 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Book a Demo
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export interface PainRow {
  pain: string;
  danger: string;
  solution: string;
}

export function PainSolution({ title, rows }: { title: string; rows: PainRow[] }) {
  return (
    <section className="bg-slate-50/60 py-20 dark:bg-slate-900/30 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{title}</h2>
        </Reveal>
        <div className="mt-12 space-y-4">
          {rows.map((r, i) => (
            <Reveal as="div" key={i} delay={i * 80}>
              <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
                <div className="flex gap-3">
                  <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{r.pain}</p>
                    <p className="mt-1 text-sm text-slate-500">{r.danger}</p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-xl bg-emerald-50/60 p-3 dark:bg-emerald-950/20">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm text-slate-700 dark:text-slate-300">{r.solution}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface FeatureItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

export function FeatureGrid({ title, features }: { title: string; features: FeatureItem[] }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{title}</h2>
        </Reveal>
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal as="div" key={f.title} delay={i * 60}>
                <div className="h-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="inline-flex rounded-xl bg-blue-50 p-3 dark:bg-blue-950/60">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{f.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqSection({ title, items }: { title: string; items: FaqItem[] }) {
  return (
    <section className="bg-slate-50/60 py-20 dark:bg-slate-900/30 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{title}</h2>
        </Reveal>
        <dl className="mt-12 space-y-4">
          {items.map((it, i) => (
            <Reveal as="div" key={i} delay={i * 60}>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <dt className="font-semibold text-slate-900 dark:text-white">{it.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{it.a}</dd>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function SolutionCta({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-[#0c1a35] px-6 py-16 text-center shadow-2xl sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">{subtitle}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <ShinyButton href="/sign-up" variant="white" size="lg">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </ShinyButton>
              <Link
                href="/contact"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 bg-transparent px-8 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function RelatedLinks({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  if (links.length === 0) return null;
  return (
    <section className="border-t border-slate-100 py-14 dark:border-slate-800/60">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">{title}</h2>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="group flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/20"
            >
              <span>{l.label}</span>
              <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Build a FAQPage JSON-LD object from FAQ items. */
export function faqJsonLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}
