import { ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { ShinyButton } from "./shiny-button";

export function CTASection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-[#0c1a35] px-6 py-16 text-center shadow-2xl shadow-blue-600/20 sm:px-12 sm:py-20">
            {/* Decorative grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-20"
              aria-hidden="true"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                maskImage: "radial-gradient(ellipse 60% 80% at 50% 50%, #000, transparent)",
                WebkitMaskImage: "radial-gradient(ellipse 60% 80% at 50% 50%, #000, transparent)",
              }}
            />
            {/* Glow orb */}
            <div
              className="animate-aurora pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(circle, rgba(96,165,250,0.6), transparent)" }}
              aria-hidden="true"
            />

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Start winning more contracts today
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-blue-100">
                Join contractors across the Gulf submitting better proposals,
                faster. 14-day free trial — no credit card required.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <ShinyButton href="/sign-up" variant="white" size="lg">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </ShinyButton>
                <a
                  href="mailto:support@thetenderos.com"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 px-8 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Talk to Sales
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
