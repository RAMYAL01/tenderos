/**
 * Editorial toolkit for the blog. Self-contained typography (no dependency on a
 * `prose` plugin) so long-form posts render consistently. Server components.
 */

import Link from "next/link";
import { ArrowRight, Calendar, Clock, Lightbulb, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { ShinyButton } from "@/components/marketing/shiny-button";

export function ArticleShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pb-12">{children}</main>
      <Footer />
    </>
  );
}

export function ArticleHeader({
  category,
  title,
  description,
  date,
  readingMinutes,
  author = "The TenderOS Team",
}: {
  category: string;
  title: string;
  description: string;
  date: string; // ISO
  readingMinutes: number;
  author?: string;
}) {
  return (
    <header className="mx-auto max-w-3xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
      <Link href="/blog" className="text-sm font-medium text-blue-600 hover:underline">
        ← All articles
      </Link>
      <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-blue-600">{category}</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{description}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <span>{author}</span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(date)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {readingMinutes} min read
        </span>
      </div>
    </header>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6">{children}</div>;
}

export function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-lg font-semibold text-slate-900 dark:text-white">{children}</h3>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-6 text-slate-700 dark:text-slate-300">{children}</ul>;
}

export function Callout({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "warning";
  title?: string;
  children: React.ReactNode;
}) {
  const styles =
    variant === "warning"
      ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20"
      : "border-blue-200 bg-blue-50/60 dark:border-blue-900/50 dark:bg-blue-950/20";
  const Icon = variant === "warning" ? AlertTriangle : Lightbulb;
  const iconColor = variant === "warning" ? "text-amber-600" : "text-blue-600";
  return (
    <div className={`rounded-2xl border p-5 ${styles}`}>
      <div className="flex gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div className="space-y-1.5">
          {title && <p className="font-semibold text-slate-900 dark:text-white">{title}</p>}
          <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-[13px] leading-relaxed text-slate-100 dark:border-slate-800">
      <code>{children}</code>
    </pre>
  );
}

export function ArticleCta({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto mt-12 max-w-3xl px-4 sm:px-6">
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-[#0c1a35] px-6 py-12 text-center shadow-2xl">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-3 max-w-lg text-blue-100">{subtitle}</p>
        <div className="mt-7 flex justify-center">
          <ShinyButton href="/sign-up" variant="white" size="lg">
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </ShinyButton>
        </div>
      </div>
    </div>
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
