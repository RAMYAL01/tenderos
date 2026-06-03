import { AnimatedCounter } from "./animated-counter";
import { Reveal } from "./reveal";

const stats = [
  { value: 200, suffix: "+", label: "Proposals generated", sub: "across pilot customers" },
  { value: 90, suffix: "s", label: "To extract requirements", sub: "from a full RFP" },
  { value: 30, suffix: "%", label: "Faster submission", sub: "vs. manual process" },
  { value: 2, suffix: "", prefix: "", label: "Languages", sub: "Arabic & English, native" },
];

export function StatsBand() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-[#0c1a35] px-6 py-12 shadow-xl dark:border-slate-800 sm:px-12">
            <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    <AnimatedCounter
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                    />
                  </div>
                  <div className="mt-2 text-sm font-medium text-blue-300">
                    {stat.label}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
