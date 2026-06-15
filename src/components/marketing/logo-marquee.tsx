// Real Gulf procurement portals + local-content programs the product is built
// around — the same set the /tender-software pages target. An honest "this is
// built for your market" signal in place of placeholder client logos.
const procurementSystems = [
  "Etimad",
  "Monaqasat",
  "In-Country Value (ICV)",
  "iktva",
  "Tawteen",
  "Local Content (LCGPA)",
  "Arabic & English RFPs",
  "Scanned, bilingual BOQs",
];

/**
 * Infinite scrolling band of the procurement systems TenderOS is designed for.
 * Swap in real customer logos here once design partners agree to be named.
 */
export function LogoMarquee() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-10 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-7 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Built for the way the Gulf procures
        </p>

        <div className="marquee-pause relative overflow-hidden">
          {/* Edge fades */}
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950" />

          <div className="flex w-max animate-marquee items-center gap-12">
            {[...procurementSystems, ...procurementSystems].map((name, i) => (
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
