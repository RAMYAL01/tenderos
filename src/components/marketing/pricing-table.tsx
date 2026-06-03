import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$149",
    period: "/month",
    description: "For small contractors getting started with AI proposals.",
    features: [
      "3 team seats",
      "5 proposals per month",
      "50 AI generation credits",
      "2 GB document storage",
      "Arabic & English support",
      "Email support",
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Professional",
    price: "$499",
    period: "/month",
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
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$1,299",
    period: "/month",
    description: "For large firms with high bid volume and dedicated teams.",
    features: [
      "30 team seats",
      "Unlimited proposals",
      "1,000 AI generation credits",
      "50 GB document storage",
      "Advanced analytics & reports",
      "Dedicated customer success",
      "Custom proposal templates",
      "API access",
    ],
    cta: "Start Free Trial",
  },
];

export function PricingTable() {
  return (
    <section id="pricing" className="border-t border-slate-100 py-20 dark:border-slate-800 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            Plans that scale with your bid volume
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Start free for 14 days. No credit card required. Upgrade anytime.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                tier.highlighted
                  ? "border-blue-600 bg-white shadow-xl shadow-blue-500/10 dark:bg-slate-900"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              )}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {tier.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {tier.description}
                </p>
              </div>

              <div className="mt-6">
                <span className="text-4xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {tier.price}
                </span>
                <span className="text-sm text-slate-500">{tier.period}</span>
              </div>

              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  className={cn(
                    "w-full",
                    tier.highlighted
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : ""
                  )}
                  variant={tier.highlighted ? "default" : "outline"}
                  size="lg"
                  asChild
                >
                  <Link href="/sign-up">{tier.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Enterprise
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Unlimited everything, SSO/SAML, dedicated infrastructure, custom
            integrations, and a dedicated customer success manager.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <a href="mailto:sales@tenderos.ai">Contact Sales</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
