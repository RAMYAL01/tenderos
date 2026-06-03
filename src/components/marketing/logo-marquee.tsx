const companies = [
  "Al-Rajhi Construction",
  "Gulf Defense Systems",
  "Emirates FM Group",
  "Saudi Infrastructure Co",
  "Qatar EPC Partners",
  "MENA Facilities",
  "Arabian Engineering",
  "Doha Contractors",
];

/**
 * Infinite scrolling band of (placeholder) client names.
 * Replace text with real client logos when available.
 */
export function LogoMarquee() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-10 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-7 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Trusted by contractors winning bids across the Gulf
        </p>

        <div className="marquee-pause relative overflow-hidden">
          {/* Edge fades */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950" />

          <div className="flex w-max animate-marquee items-center gap-12">
            {[...companies, ...companies].map((name, i) => (
              <span
                key={i}
                className="whitespace-nowrap text-sm font-semibold tracking-tight text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
