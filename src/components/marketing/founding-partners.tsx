import { Handshake, Tag, MessagesSquare, Map } from "lucide-react";
import { Reveal } from "./reveal";
import { ShinyButton } from "./shiny-button";

const APPLY_HREF =
  "mailto:support@thetenderos.com?subject=Design%20partner%20program&body=Hi%20TenderOS%20team%20%E2%80%94%20we%27d%20like%20to%20join%20the%20design%20partner%20program.%0D%0A%0D%0ACompany%3A%0D%0AWhat%20we%20bid%20(sector%20%2F%20region)%3A%0D%0ATeam%20size%3A";

const benefits = [
  {
    icon: Tag,
    title: "Founder pricing, locked in",
    body: "Lock today's rate for as long as you stay with us.",
  },
  {
    icon: MessagesSquare,
    title: "A direct line to the team",
    body: "Your feedback goes straight to the people building it — not a support queue.",
  },
  {
    icon: Map,
    title: "Your workflow on the roadmap",
    body: "We prioritize the tenders, formats, and rules you actually bid.",
  },
];

export function FoundingPartners() {
  return (
    <section id="design-partners" className="py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
                <Handshake className="h-4 w-4" />
                Design partners
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                Be one of our first design partners
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
                We&apos;re onboarding a small group of contractors to shape TenderOS — built
                around the way your team actually bids, in Arabic and English.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {benefits.map((b) => {
                const Icon = b.icon;
                return (
                  <div key={b.title} className="text-center sm:text-left">
                    <div className="inline-flex rounded-xl bg-blue-50 p-3 dark:bg-blue-950/60">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                      {b.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {b.body}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-3">
              <ShinyButton href={APPLY_HREF} size="lg" external>
                Apply to join
              </ShinyButton>
              <p className="text-xs text-slate-400">
                A short email — we reply within one business day.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
