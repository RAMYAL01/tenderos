import {
  Landmark,
  HardHat,
  Building2,
  PencilRuler,
  Wrench,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "./reveal";

const sectors: { icon: LucideIcon; name: string; body: string }[] = [
  {
    icon: Landmark,
    name: "Government contractors",
    body: "Hold up under procurement scrutiny — every requirement mapped to a response, and every claim cited to a source document.",
  },
  {
    icon: HardHat,
    name: "EPC contractors",
    body: "Price complex, multi-discipline bids from your own rates. BOQs are stitched across pages and the math is computed deterministically.",
  },
  {
    icon: Building2,
    name: "Construction firms",
    body: "Turn 100-page BOQs and scanned drawings into a structured, priced bid — without the manual re-keying.",
  },
  {
    icon: PencilRuler,
    name: "Engineering consultancies",
    body: "Assemble technical proposals from your past performance, CVs, and methodology — drafted and cited, not copy-pasted.",
  },
  {
    icon: Wrench,
    name: "Facilities management",
    body: "Respond to recurring service tenders faster, and reuse what worked on your last winning bid.",
  },
  {
    icon: Truck,
    name: "Suppliers",
    body: "Find supply and framework tenders that fit, and qualify each one before you commit a quote.",
  },
];

export function Industries() {
  return (
    <section id="industries" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Who it&apos;s for
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Built for the way your sector bids
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            One workspace, tuned to the tenders each team actually competes for.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal as="div" key={s.name} delay={i * 70}>
                <div className="h-full rounded-2xl border border-slate-100 bg-white p-7 shadow-sm transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="inline-flex w-fit rounded-xl bg-blue-50 p-3 dark:bg-blue-950/60">
                    <Icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                    {s.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
