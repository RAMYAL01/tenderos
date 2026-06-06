"use client";

import { useRef, useState, useCallback } from "react";
import { Check, Sparkles, Rocket, Zap, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";
import { ShinyButton } from "./shiny-button";

interface PricingTier {
  name: string;
  monthly: number;
  description: string;
  icon: typeof Rocket;
  iconColor: string;
  iconBg: string;
  features: string[];
  highlighted?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    monthly: 149,
    description: "For small contractors getting started with AI proposals.",
    icon: Rocket,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50 dark:bg-blue-950",
    features: [
      "3 team seats",
      "5 proposals per month",
      "50 AI generation credits",
      "2 GB document storage",
      "Arabic & English support",
      "Email support",
    ],
  },
  {
    name: "Professional",
    monthly: 499,
    description: "For growing firms managing multiple active bids.",
    icon: Zap,
    iconColor: "text-white",
    iconBg: "bg-white/10",
    features: [
      "10 team seats",
      "20 proposals per month",
      "250 AI generation credits",
      "10 GB document storage",
      "Content library & reuse",
      "Priority email support",
      "Compliance analytics",
    ],
    highlighted: true,
  },
  {
    name: "Business",
    monthly: 1299,
    description: "For large firms with high bid volume and dedicated teams.",
    icon: Building2,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-50 dark:bg-violet-950",
    features: [
      "30 team seats",
      "Unlimited proposals",
      "1,000 AI generation credits",
      "50 GB document storage",
      "Advanced analytics & reports",
      "Dedicated customer success",
      "Custom templates · API access",
    ],
  },
];

export function PricingTable() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="bg-slate-50 py-20 dark:bg-slate-900/30 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
            Plans that scale with your bid volume
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Start your 14-day free trial. Cancel anytime.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
                !annual
                  ? "bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-all duration-300",
                annual
                  ? "bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Annual
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  annual
                    ? "bg-emerald-500/20 text-emerald-300 dark:bg-emerald-100 dark:text-emerald-700"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                )}
              >
                Save 20%
              </span>
            </button>
          </div>
        </Reveal>

        {/* Pricing cards */}
        <div className="mt-16 grid grid-cols-1 items-center gap-6 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 90}>
              <PriceCard tier={tier} annual={annual} />
            </Reveal>
          ))}
        </div>

        {/* Enterprise */}
        <Reveal>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:text-left">
            <div className="flex items-start gap-4">
              <div className="hidden rounded-xl bg-slate-100 p-3 dark:bg-slate-800 sm:block">
                <Building2 className="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Enterprise
                </h3>
                <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
                  Unlimited everything, SSO/SAML, dedicated infrastructure, custom
                  integrations, and a dedicated customer success manager.
                </p>
              </div>
            </div>
            <ShinyButton href="mailto:support@thetenderos.com" variant="ghost" external className="shrink-0">
              Contact Sales
            </ShinyButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Individual card with cursor spotlight ── */

function PriceCard({ tier, annual }: { tier: PricingTier; annual: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [glow, setGlow] = useState({ x: 50, y: 0, o: 0 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setGlow({ x, y, o: 1 }));
  }, []);

  const onLeave = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setGlow((g) => ({ ...g, o: 0 }));
  }, []);

  const price = annual ? Math.round(tier.monthly * 0.8) : tier.monthly;
  const Icon = tier.icon;
  const checkoutHref = `/checkout?tier=${tier.name.toUpperCase()}&cycle=${annual ? "annual" : "monthly"}`;

  if (tier.highlighted) {
    // Premium dark card with rotating glow border
    return (
      <div className="relative lg:-my-4">
        {/* Rotating gradient border */}
        <div className="absolute -inset-[1.5px] overflow-hidden rounded-[1.5rem]">
          <div
            className="animate-spin-slow absolute left-1/2 top-1/2 h-[180%] w-[180%] -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0%, #3b82f6 18%, #22d3ee 30%, transparent 45%, transparent 70%, #3b82f6 88%, transparent 100%)",
            }}
          />
        </div>

        <div
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          className="relative flex h-full flex-col overflow-hidden rounded-[1.45rem] bg-gradient-to-br from-slate-900 to-[#0a1730] p-8 shadow-2xl shadow-blue-900/40"
        >
          {/* Grid texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000, transparent)",
              WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, #000, transparent)",
            }}
          />
          {/* Cursor spotlight */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: glow.o,
              background: `radial-gradient(300px circle at ${glow.x}% ${glow.y}%, rgba(59,130,246,0.25), transparent 65%)`,
            }}
          />

          {/* Badge */}
          <div className="relative mb-6 flex items-center justify-between">
            <div className={cn("rounded-xl p-2.5", tier.iconBg)}>
              <Icon className={cn("h-5 w-5", tier.iconColor)} />
            </div>
            <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-blue-500/30">
              <Sparkles className="h-3 w-3" />
              Most Popular
            </span>
          </div>

          <h3 className="relative text-xl font-bold text-white">{tier.name}</h3>
          <p className="relative mt-1 text-sm text-slate-400">{tier.description}</p>

          <div className="relative mt-6 flex items-end gap-2">
            <span className="bg-gradient-to-r from-white to-blue-200 bg-clip-text text-5xl font-bold tabular-nums text-transparent">
              ${price.toLocaleString()}
            </span>
            <span className="mb-1.5 text-sm text-slate-400">/month</span>
          </div>
          <p className="relative mt-1 h-4 text-xs text-cyan-300">
            {annual ? `Billed $${(price * 12).toLocaleString()} annually` : ""}
          </p>

          <ul className="relative mt-7 flex flex-1 flex-col gap-3.5">
            {tier.features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-slate-200">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
                  <Check className="h-3 w-3 text-white" />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <ShinyButton href={checkoutHref} variant="primary" size="lg" className="relative mt-8 w-full">
            Start Free Trial
          </ShinyButton>
        </div>
      </div>
    );
  }

  // Standard white card with spotlight
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-none"
    >
      {/* Cursor spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: glow.o,
          background: `radial-gradient(300px circle at ${glow.x}% ${glow.y}%, rgba(59,130,246,0.07), transparent 65%)`,
        }}
      />

      <div className={cn("relative mb-5 w-fit rounded-xl p-2.5", tier.iconBg)}>
        <Icon className={cn("h-5 w-5", tier.iconColor)} />
      </div>

      <h3 className="relative text-xl font-bold text-slate-900 dark:text-white">
        {tier.name}
      </h3>
      <p className="relative mt-1 text-sm text-slate-500">{tier.description}</p>

      <div className="relative mt-6 flex items-end gap-2">
        <span className="text-5xl font-bold tabular-nums text-slate-900 dark:text-white">
          ${price.toLocaleString()}
        </span>
        <span className="mb-1.5 text-sm text-slate-500">/month</span>
      </div>
      <p className="relative mt-1 h-4 text-xs text-emerald-600">
        {annual ? `Billed $${(price * 12).toLocaleString()} annually` : ""}
      </p>

      <ul className="relative mt-7 flex flex-1 flex-col gap-3.5">
        {tier.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Check className="h-3 w-3 text-blue-600" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <ShinyButton href={checkoutHref} variant="ghost" size="lg" className="relative mt-8 w-full">
        Start Free Trial
      </ShinyButton>
    </div>
  );
}
