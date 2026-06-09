import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

/**
 * Shared chrome for the legal pages (Terms / Privacy / Refund).
 * Keeps typography and layout identical across all three, and renders a
 * sticky in-page table of contents on large screens.
 */
export function LegalShell({
  eyebrow,
  title,
  intro,
  updated,
  toc,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  toc: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main>
        {/* Header */}
        <section className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(59,130,246,0.10), transparent)",
            }}
          />
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              {intro}
            </p>
            <p className="mt-6 text-sm text-slate-400">Last updated: {updated}</p>
          </div>
        </section>

        {/* Body + TOC */}
        <section className="py-14 sm:py-16">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 sm:px-6 lg:grid-cols-[220px_1fr]">
            {/* TOC */}
            <aside className="hidden lg:block">
              <nav className="sticky top-24">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                  On this page
                </p>
                <ul className="space-y-2 border-l border-slate-200 dark:border-slate-800">
                  {toc.map((t) => (
                    <li key={t.id}>
                      <a
                        href={`#${t.id}`}
                        className="-ml-px block border-l border-transparent pl-4 text-sm text-slate-500 transition-colors hover:border-blue-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        {t.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>

            {/* Content — semantic HTML styled via child selectors */}
            <article
              className={[
                "max-w-none text-slate-600 dark:text-slate-300",
                "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-slate-900 dark:[&_h2]:text-white",
                "[&_h2:first-child]:mt-0",
                "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900 dark:[&_h3]:text-white",
                "[&_p]:mt-4 [&_p]:text-[15px] [&_p]:leading-7",
                "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:text-[15px] [&_ul]:leading-7",
                "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ol]:text-[15px] [&_ol]:leading-7",
                "[&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white",
                "[&_a]:font-medium [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-blue-400",
                "[&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[14px]",
                "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900 dark:[&_th]:border-slate-800 dark:[&_th]:bg-slate-900 dark:[&_th]:text-white",
                "[&_td]:border [&_td]:border-slate-200 [&_td]:p-2.5 [&_td]:align-top dark:[&_td]:border-slate-800",
              ].join(" ")}
            >
              {children}
            </article>
          </div>
        </section>

        {/* Cross-links */}
        <section className="border-t border-slate-100 py-12 dark:border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6">
            <p className="text-sm text-slate-500">
              Questions about these terms? Email{" "}
              <a
                href="mailto:support@thetenderos.com"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                support@thetenderos.com
              </a>
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link href="/terms" className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/refund" className="text-slate-500 hover:text-slate-900 dark:hover:text-white">
                Refund Policy
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
