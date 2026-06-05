"use client";

import { useRef, useState, useCallback } from "react";
import { Logo } from "@/components/ui/logo";
import { BrandMark } from "@/components/ui/brand-mark";
import {
  Sparkles,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from "lucide-react";

const stats = [
  { value: "200+", label: "Proposals Generated" },
  { value: "4.8/5", label: "Pilot Satisfaction" },
  { value: "30%", label: "Faster Submission" },
];

/**
 * Immersive 3D branding panel for the auth pages. Animated mesh gradient,
 * mouse-parallax depth layers, floating glass cards, an orbiting ring
 * around the mark, and rising particles.
 */
export function BrandPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const [p, setP] = useState({ x: 0, y: 0 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setP({ x: nx, y: ny }));
  }, []);

  const onLeave = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    setP({ x: 0, y: 0 });
  }, []);

  // Parallax helper — depth multiplier (negative = moves opposite cursor)
  const layer = (depth: number) => ({
    transform: `translate3d(${p.x * depth}px, ${p.y * depth}px, 0)`,
  });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="perspective-1500 relative hidden w-[55%] flex-col justify-between overflow-hidden bg-slate-950 p-10 lg:flex xl:p-14"
    >
      {/* Animated mesh gradient */}
      <div
        aria-hidden="true"
        className="animate-mesh pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(37,99,235,0.45), transparent 45%), radial-gradient(circle at 80% 70%, rgba(59,130,246,0.35), transparent 45%), radial-gradient(circle at 50% 50%, rgba(14,165,233,0.25), transparent 55%)",
        }}
      />

      {/* Depth grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          ...layer(-14),
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 75% 75% at 50% 40%, #000, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 75% at 50% 40%, #000, transparent)",
        }}
      />

      {/* Rising particles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {[
          { l: "12%", d: "0s", s: 5, dur: "7s" },
          { l: "28%", d: "1.5s", s: 3, dur: "9s" },
          { l: "44%", d: "3s", s: 6, dur: "8s" },
          { l: "63%", d: "0.8s", s: 4, dur: "10s" },
          { l: "78%", d: "2.2s", s: 5, dur: "7.5s" },
          { l: "90%", d: "4s", s: 3, dur: "9.5s" },
        ].map((dot, i) => (
          <span
            key={i}
            className="animate-rise absolute bottom-1/4 rounded-full bg-blue-400/40"
            style={{
              left: dot.l,
              width: dot.s,
              height: dot.s,
              animationDelay: dot.d,
              animationDuration: dot.dur,
            }}
          />
        ))}
      </div>

      {/* Orbiting accent ring behind the mark, top-left */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-24 top-28 h-40 w-40"
        style={layer(18)}
      >
        <div className="animate-spin-slow absolute inset-0 rounded-full border border-blue-400/20" />
        <div className="animate-spin-slow-rev absolute inset-4 rounded-full border border-cyan-400/15" />
      </div>

      {/* Top: Logo */}
      <div className="relative z-10" style={layer(8)}>
        <Logo variant="dark" size={40} />
      </div>

      {/* Center: Value Proposition */}
      <div className="relative z-10 max-w-md" style={layer(22)}>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-blue-200 backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Powered by Claude AI
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          Win more contracts.
          <br />
          Write better proposals.
          <br />
          <span className="bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
            10x faster.
          </span>
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-300/80">
          AI-powered bilingual proposal intelligence for government contractors,
          EPC firms, and defense companies across MENA and globally.
        </p>
        {/* Social proof stats */}
        <div className="mt-9 grid grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <span className="text-2xl font-bold tabular-nums text-white">
                {stat.value}
              </span>
              <span className="mt-1 text-xs text-slate-400">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating glass cards (foreground depth) */}
      <div
        className="animate-float-3d absolute right-10 top-28 z-10 hidden w-52 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md xl:block"
        style={layer(40)}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">
              Proposal ready
            </div>
            <div className="text-[10px] text-slate-400">in 4 min 12 sec</div>
          </div>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" />
        </div>
        <div className="mt-1.5 text-[10px] text-slate-400">87% compliance</div>
      </div>

      <div
        className="animate-float-3d absolute right-20 top-1/2 z-10 hidden items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 backdrop-blur-md xl:flex"
        style={{ ...layer(55), animationDelay: "1.2s" }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
          <FileText className="h-4 w-4 text-blue-300" />
        </div>
        <div>
          <div className="text-xs font-semibold text-white">
            142 requirements
          </div>
          <div className="text-[10px] text-slate-400">AR + EN extracted</div>
        </div>
      </div>

      {/* Bottom: Trust bar */}
      <div className="relative z-10" style={layer(8)}>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-blue-300" />
          Enterprise-grade security · Encrypted &amp; isolated workspaces
        </div>
        <div className="mt-3 flex items-center gap-3 opacity-50">
          {["Construction", "Defense", "Facilities"].map((name) => (
            <div
              key={name}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] text-slate-400"
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Decorative floating mark, faint, deep background */}
      <div
        aria-hidden="true"
        className="animate-float-3d pointer-events-none absolute -bottom-6 left-1/2 z-0 opacity-[0.07]"
        style={layer(-10)}
      >
        <BrandMark size={120} variant="dark" />
      </div>
    </div>
  );
}
