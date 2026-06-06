"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  FileSearch,
  CheckSquare,
  PenTool,
  Languages,
  Library,
  ShieldCheck,
  HelpCircle,
  Mail,
  BookOpen,
  Newspaper,
  Sparkles,
  Calculator,
  MapPin,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ShinyButton } from "./shiny-button";
import { cn } from "@/lib/utils";

const productMenu = [
  { icon: FileSearch, title: "Requirement Extraction", desc: "Parse any RFP in 90 seconds", href: "/#features", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
  { icon: CheckSquare, title: "Compliance Matrix", desc: "AI-powered gap analysis", href: "/#features", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
  { icon: PenTool, title: "Proposal Generation", desc: "Draft sections with Claude AI", href: "/#features", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
  { icon: Languages, title: "Bilingual (AR/EN)", desc: "Native Arabic & English", href: "/#features", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
  { icon: Library, title: "Content Library", desc: "Reuse past performance", href: "/#features", color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950" },
  { icon: ShieldCheck, title: "Enterprise Security", desc: "Encrypted, isolated workspaces", href: "/#features", color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950" },
];

const solutionsMenu = [
  { icon: Calculator, title: "BOQ Pricing Engine", desc: "Deterministic, float-safe pricing", href: "/solutions/boq-pricing", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950" },
  { icon: FileSearch, title: "Tender & BOQ Extraction", desc: "Structured RFPs in 90 seconds", href: "/solutions/tender-extraction", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
];

const regionLinks = [
  { label: "Construction — Saudi Arabia", href: "/tender-software/construction-in-saudi-arabia" },
  { label: "EPC — UAE", href: "/tender-software/epc-in-uae" },
  { label: "Facilities Management — Qatar", href: "/tender-software/facilities-management-in-qatar" },
  { label: "Oil & Gas — Saudi Arabia", href: "/tender-software/oil-and-gas-in-saudi-arabia" },
  { label: "Construction — Egypt", href: "/tender-software/construction-in-egypt" },
];

const resourcesMenu = [
  { icon: HelpCircle, title: "FAQ", desc: "Common questions", href: "/#faq" },
  { icon: BookOpen, title: "Documentation", desc: "Guides & API docs", href: "/contact" },
  { icon: Newspaper, title: "Blog", desc: "Product & industry news", href: "/contact" },
  { icon: Mail, title: "Contact", desc: "Talk to our team", href: "/contact" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const [openMenu, setOpenMenu] = useState<"product" | "solutions" | "resources" | null>(null);
  const [activeSection, setActiveSection] = useState("");
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = ["features", "pricing", "faq"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const openDropdown = (menu: "product" | "solutions" | "resources") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(menu);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 140);
  };

  return (
    <>
      {/* Announcement bar */}
      {showBanner && (
        <div className="relative flex items-center justify-center gap-2 overflow-hidden bg-gradient-to-r from-blue-600 via-blue-500 to-blue-700 px-4 py-2 text-center text-xs font-medium text-white">
          {/* moving sheen */}
          <span className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-white/15 blur-md" />
          <Sparkles className="relative h-3.5 w-3.5 shrink-0" />
          <span className="relative">
            New: AI proposal generation now supports bilingual export.{" "}
            <Link href="/sign-up" className="underline underline-offset-2 hover:text-blue-100">
              Try it free →
            </Link>
          </span>
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss announcement"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main nav — morphs into a floating pill island on scroll */}
      <header className="sticky top-0 z-40 px-3 transition-all duration-300 sm:px-4">
        <nav
          className={cn(
            "mx-auto flex items-center justify-between transition-all duration-300 ease-out",
            scrolled
              ? "mt-3 h-14 max-w-5xl rounded-2xl border border-slate-200/70 bg-white/80 px-3 pl-5 shadow-lg shadow-slate-900/[0.06] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/80"
              : "h-20 max-w-6xl border-b border-transparent px-1"
          )}
        >
          {/* Logo */}
          <Link
            href="/"
            className="transition-all duration-300 hover:scale-[1.04] hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.4)]"
          >
            <Logo size={32} />
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-0.5 lg:flex">
            <Dropdown
              label="Product"
              isOpen={openMenu === "product"}
              active={activeSection === "features"}
              onEnter={() => openDropdown("product")}
              onLeave={scheduleClose}
              panelClassName="w-[560px]"
            >
              <div className="grid grid-cols-2 gap-1 p-3">
                {productMenu.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="group/item flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className={cn("rounded-lg p-2 transition-transform group-hover/item:scale-110", item.bg)}>
                        <Icon className={cn("h-4 w-4", item.color)} />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                        <span className="block text-xs text-slate-500">{item.desc}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Dropdown>

            <Dropdown
              label="Solutions"
              isOpen={openMenu === "solutions"}
              onEnter={() => openDropdown("solutions")}
              onLeave={scheduleClose}
              panelClassName="w-[540px]"
            >
              <div className="grid grid-cols-2 gap-2 p-3">
                <div className="space-y-1">
                  {solutionsMenu.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="group/item flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className={cn("rounded-lg p-2 transition-transform group-hover/item:scale-110", item.bg)}>
                          <Icon className={cn("h-4 w-4", item.color)} />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-slate-900 dark:text-white">{item.title}</span>
                          <span className="block text-xs text-slate-500">{item.desc}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/40">
                  <p className="flex items-center gap-1.5 px-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <MapPin className="h-3 w-3" /> By region
                  </p>
                  {regionLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="block rounded-lg px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            </Dropdown>

            <PillLink href="/#pricing" active={activeSection === "pricing"}>
              Pricing
            </PillLink>
            <PillLink href="/about">About</PillLink>

            <Dropdown
              label="Resources"
              isOpen={openMenu === "resources"}
              onEnter={() => openDropdown("resources")}
              onLeave={scheduleClose}
              panelClassName="w-72"
            >
              <div className="p-2">
                {resourcesMenu.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <span className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                        <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                        <span className="block text-xs text-slate-500">{item.desc}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Dropdown>
          </div>

          {/* CTA buttons */}
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Sign In
            </Link>
            <ShinyButton href="/sign-up" size="sm">
              Start Free Trial
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </ShinyButton>
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-slate-700 dark:text-slate-200" />
          </button>
        </nav>
      </header>

      {/* Mobile drawer */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "visible" : "invisible")}>
        <div
          className={cn(
            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={cn(
            "absolute right-0 top-0 flex h-full w-[84%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-950",
            mobileOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <Logo size={30} />
            <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2" aria-label="Close menu">
              <X className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {[
              { label: "Product", href: "/#features" },
              { label: "BOQ Pricing Engine", href: "/solutions/boq-pricing" },
              { label: "Tender & BOQ Extraction", href: "/solutions/tender-extraction" },
              { label: "Pricing", href: "/#pricing" },
              { label: "About", href: "/about" },
              { label: "FAQ", href: "/#faq" },
              { label: "Contact", href: "/contact" },
            ].map((link, i) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center justify-between border-b border-slate-50 py-3.5 text-base font-medium text-slate-800 transition-all dark:border-slate-800/50 dark:text-slate-200",
                  mobileOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                )}
                style={{ transitionDelay: mobileOpen ? `${i * 50 + 100}ms` : "0ms" }}
              >
                {link.label}
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 p-5 dark:border-slate-800">
            <Link
              href="/sign-in"
              onClick={() => setMobileOpen(false)}
              className="flex h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Sign In
            </Link>
            <ShinyButton href="/sign-up" size="md" className="w-full">
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </ShinyButton>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function PillLink({
  href,
  children,
  active = false,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
        active
          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      )}
    >
      {children}
    </Link>
  );
}

function Dropdown({
  label,
  isOpen,
  active = false,
  onEnter,
  onLeave,
  panelClassName,
  children,
}: {
  label: string;
  isOpen: boolean;
  active?: boolean;
  onEnter: () => void;
  onLeave: () => void;
  panelClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          active || isOpen
            ? "text-blue-700 dark:text-blue-300"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        )}
      >
        {label}
        <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <div
        className={cn(
          "absolute left-1/2 top-full -translate-x-1/2 pt-3 transition-all duration-200 ease-out",
          isOpen
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible -translate-y-1 scale-95 opacity-0"
        )}
      >
        <div
          className={cn(
            "origin-top rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40",
            panelClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
