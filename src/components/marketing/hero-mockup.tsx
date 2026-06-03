import { FileText, CheckCircle2, Clock, AlertTriangle, Sparkles } from "lucide-react";

/**
 * A realistic, CSS-rendered preview of the TenderOS product UI.
 * Used in the hero in place of a screenshot so the page loads instantly
 * and looks crisp at any resolution.
 */
export function HeroMockup() {
  return (
    <div className="relative">
      {/* Main app window */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-blue-900/10 dark:border-slate-700 dark:bg-slate-900">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-slate-400 dark:bg-slate-900">
            app.tenderos.ai/tenders/riyadh-metro-phase-3
          </div>
        </div>

        {/* App body */}
        <div className="grid grid-cols-12 gap-0">
          {/* Mini sidebar */}
          <div className="col-span-3 hidden flex-col gap-1 border-r border-slate-100 bg-slate-900 p-3 dark:border-slate-800 sm:flex">
            <div className="mb-2 h-5 w-20 rounded bg-white/10" />
            {["Dashboard", "Tenders", "Proposals", "Compliance"].map((item, i) => (
              <div
                key={item}
                className={`flex items-center gap-2 rounded px-2 py-1.5 text-[10px] ${
                  i === 1 ? "bg-blue-600 text-white" : "text-slate-400"
                }`}
              >
                <span className="h-2 w-2 rounded-sm bg-current opacity-60" />
                {item}
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="col-span-12 p-4 sm:col-span-9">
            {/* Title row */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  Riyadh Metro — Phase 3 FM
                </div>
                <div className="text-[10px] text-slate-400">
                  RFP · Deadline in 12 days
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Sparkles className="h-3 w-3" />
                AI Active
              </div>
            </div>

            {/* Stat chips */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[
                { icon: FileText, label: "Requirements", value: "142", color: "text-blue-600" },
                { icon: CheckCircle2, label: "Compliance", value: "87%", color: "text-emerald-600" },
                { icon: Clock, label: "Sections", value: "9/12", color: "text-violet-600" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                      {s.value}
                    </div>
                    <div className="text-[9px] text-slate-400">{s.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Compliance matrix preview */}
            <div className="rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-500 dark:border-slate-800">
                Compliance Matrix
              </div>
              {[
                { req: "ISO 9001 certification", status: "complete" },
                { req: "Local content ≥ 30%", status: "complete" },
                { req: "24/7 emergency response", status: "progress" },
                { req: "Min. 5 years FM experience", status: "gap" },
              ].map((row) => (
                <div
                  key={row.req}
                  className="flex items-center justify-between border-b border-slate-50 px-3 py-2 last:border-0 dark:border-slate-800/50"
                >
                  <span className="text-[10px] text-slate-600 dark:text-slate-300">
                    {row.req}
                  </span>
                  {row.status === "complete" && (
                    <span className="flex items-center gap-1 text-[9px] font-medium text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Met
                    </span>
                  )}
                  {row.status === "progress" && (
                    <span className="flex items-center gap-1 text-[9px] font-medium text-amber-600">
                      <Clock className="h-3 w-3" /> Drafting
                    </span>
                  )}
                  {row.status === "gap" && (
                    <span className="flex items-center gap-1 text-[9px] font-medium text-red-500">
                      <AlertTriangle className="h-3 w-3" /> Gap
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating accent card — top right */}
      <div className="absolute -right-4 -top-5 hidden animate-float-slow rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 md:block">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-900 dark:text-white">
              Proposal generated
            </div>
            <div className="text-[9px] text-slate-400">in 4 min 12 sec</div>
          </div>
        </div>
      </div>

      {/* Floating accent card — bottom left */}
      <div
        className="absolute -bottom-5 -left-4 hidden animate-float-slow rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 md:block"
        style={{ animationDelay: "1.5s" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-900 dark:text-white">
              142 requirements extracted
            </div>
            <div className="text-[9px] text-slate-400">Arabic + English</div>
          </div>
        </div>
      </div>
    </div>
  );
}
