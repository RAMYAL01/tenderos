"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

interface PricingTier {
  name: string;
  monthly: number;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    monthly: 149,
    description: "For small contractors getting started with AI proposals.",
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
            Start free for 14 days. No credit card required.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                !annual
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                annual
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              Annual
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  annual
                    ? "bg-white/20 text-white"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                )}
              >
                −20%
              </span>
            </button>
          </div>
        </Reveal>

        {/* Pricing cards */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((tier, i) => {
            const price = annual
              ? Math.round(tier.monthly * 0.8)
              : tier.monthly;
            return (
              <Reveal key={tier.name} delay={i * 90}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border p-8 transition-all",
                    tier.highlighted
                      ? "border-blue-600 bg-white shadow-2xl shadow-blue-600/10 dark:bg-slate-900 lg:-mt-4 lg:mb-4"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                  )}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {tier.description}
                  </p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
                      ${price.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-500">/month</span>
                  </div>
                  {annual && (
                    <p className="mt-1 text-xs text-emerald-600">
                      Billed ${(price * 12).toLocaleString()} annually
                    </p>
                  )}

                  <ul className="mt-7 flex flex-1 flex-col gap-3">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                            tier.highlighted
                              ? "bg-blue-100 dark:bg-blue-950"
                              : "bg-slate-100 dark:bg-slate-800"
                          )}
                        >
                          <Check className="h-3 w-3 text-blue-600" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={cn(
                      "mt-8 w-full",
                      tier.highlighted &&
                        "bg-blue-600 text-white hover:bg-blue-700"
                    )}
                    variant={tier.highlighted ? "default" : "outline"}
                    size="lg"
                    asChild
                  >
                    <Link href="/sign-up">Start Free Trial</Link>
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Enterprise */}
        <Reveal>
          <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:text-left">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Enterprise
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Unlimited everything, SSO/SAML, dedicated infrastructure, and a
                dedicated customer success manager.
              </p>
            </div>
            <Button variant="outline" size="lg" className="shrink-0" asChild>
              <a href="mailto:sales@tenderos.ai">Contact Sales</a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
