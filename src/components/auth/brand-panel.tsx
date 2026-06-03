import Image from "next/image";

const stats = [
  { value: "200+", label: "Proposals Generated" },
  { value: "4.8/5", label: "Pilot Satisfaction" },
  { value: "30%", label: "Faster Submission" },
];

/**
 * Left-side branding panel for auth pages.
 * Static, no client JS — renders the TenderOS value prop,
 * social proof metrics, and brand logo.
 */
export function BrandPanel() {
  return (
    <div className="relative hidden w-[55%] flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-[#0c1a35] to-slate-900 p-10 lg:flex xl:p-14">
      {/* Decorative gradient orbs */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 600px 400px at 20% 30%, rgba(59,130,246,0.15), transparent), radial-gradient(ellipse 500px 300px at 80% 70%, rgba(37,99,235,0.1), transparent)",
        }}
      />

      {/* Top: Logo */}
      <div className="relative z-10">
        <Image
          src="/images/logo-dark.png"
          alt="TenderOS"
          width={180}
          height={48}
          className="h-10 w-auto"
          priority
        />
      </div>

      {/* Center: Value Proposition */}
      <div className="relative z-10 max-w-md">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Win more contracts.
          <br />
          Write better proposals.
          <br />
          <span className="text-blue-400">10x faster.</span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-400">
          AI-powered bilingual proposal intelligence for government contractors,
          EPC firms, and defense companies across MENA and globally.
        </p>

        {/* Arabic tagline */}
        <p
          className="mt-3 font-arabic text-sm text-slate-500"
          dir="rtl"
          lang="ar"
        >
          نظام تشغيل الفوز بالعقود — الذكاء الاصطناعي لتقديم العطاءات
        </p>

        {/* Social proof stats */}
        <div className="mt-10 grid grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className="text-2xl font-bold tabular-nums text-white">
                {stat.value}
              </span>
              <span className="mt-1 text-xs text-slate-500">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: Trust bar */}
      <div className="relative z-10">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-600">
          Trusted by contractors across the Gulf
        </p>
        <div className="mt-3 flex items-center gap-6 opacity-40">
          {/* Placeholder for client logos — replace with real logos */}
          {["Construction Co", "Defense Group", "FM Solutions"].map((name) => (
            <div
              key={name}
              className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-500"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
