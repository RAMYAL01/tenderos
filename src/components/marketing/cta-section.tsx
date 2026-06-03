import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="border-t border-slate-100 py-20 dark:border-slate-800 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Start winning more contracts today
        </h2>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
          Join contractors across the Gulf who use TenderOS to submit better
          proposals, faster. 14-day free trial — no credit card required.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="h-12 gap-2 px-8 text-sm"
            asChild
          >
            <Link href="/sign-up">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 px-8 text-sm"
            asChild
          >
            <a href="mailto:sales@tenderos.ai">Talk to Sales</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
