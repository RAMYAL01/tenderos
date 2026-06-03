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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const productMenu = [
  { icon: FileSearch, title: "Requirement Extraction", desc: "Parse any RFP in 90 seconds", href: "/#features", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
  { icon: CheckSquare, title: "Compliance Matrix", desc: "AI-powered gap analysis", href: "/#features", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
  { icon: PenTool, title: "Proposal Generation", desc: "Draft sections with Claude AI", href: "/#features", color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950" },
  { icon: Languages, title: "Bilingual (AR/EN)", desc: "Native Arabic & English", href: "/#features", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950" },
  { icon: Library, title: "Content Library", desc: "Reuse past performance", href: "/#features", color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950" },
  { icon: ShieldCheck, title: "Enterprise Security", desc: "Encrypted, isolated workspaces", href: "/#features", color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950" },
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
  const [openMenu, setOpenMenu] = useState<"product" | "resources" | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const openDropdown = (menu: "product" | "resources") => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(menu);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };

  return (
    <>
      {/* Announcement bar — scrolls away in normal flow */}
      {showBanner && (
        <div className="relative flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 px-4 py-2 text-center text-xs font-medium text-white">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>
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

      {/* Main nav — sticks to top after the banner scrolls away */}
      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-all duration-300",
          scrolled
            ? "border-slate-200/80 bg-white/85 shadow-sm backdrop-blur-lg dark:border-slate-800 dark:bg-slate-950/85"
            : "border-transparent bg-white/60 backdrop-blur-sm dark:bg-slate-950/60"
        )}
      >
        <nav
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between px-4 transition-all duration-300 sm:px-6",
            scrolled ? "h-16" : "h-20"
          )}
        >
          {/* Logo */}
          <Link href="/" className="transition-transform hover:scale-[1.03]">
            <Logo size={34} />
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 lg:flex">
            {/* Product dropdown */}
            <div
              className="relative"
              onMouseEnter={() => openDropdown("product")}
              onMouseLeave={scheduleClose}
            >
              <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Product
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openMenu === "product" && "rotate-180"
                  )}
                />
              </button>

              <div
                className={cn(
                  "absolute left-1/2 top-full w-[560px] -translate-x-1/2 pt-3 transition-all duration-200",
                  openMenu === "product"
                    ? "visible translate-y-0 opacity-100"
                    : "invisible translate-y-1 opacity-0"
                )}
              >
                <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
                  {productMenu.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.title}
                        href={item.href}
                        className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <span className={cn("rounded-lg p-2", item.bg)}>
                          <Icon className={cn("h-4 w-4", item.color)} />
                        </span>
                        <span>
                          <span className="block text-sm font-medium text-slate-900 dark:text-white">
                            {item.title}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {item.desc}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <NavLink href="/#pricing">Pricing</NavLink>
            <NavLink href="/about">About</NavLink>

            {/* Resources dropdown */}
            <div
              className="relative"
              onMouseEnter={() => openDropdown("resources")}
              onMouseLeave={scheduleClose}
            >
              <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Resources
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    openMenu === "resources" && "rotate-180"
                  )}
                />
              </button>

              <div
                className={cn(
                  "absolute left-1/2 top-full w-72 -translate-x-1/2 pt-3 transition-all duration-200",
                  openMenu === "resources"
                    ? "visible translate-y-0 opacity-100"
                    : "invisible translate-y-1 opacity-0"
                )}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
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
                          <span className="block text-xs text-slate-500">
                            {item.desc}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button
              size="sm"
              className="group relative overflow-hidden shadow-sm shadow-blue-600/20"
              asChild
            >
              <Link href="/sign-up">
                <span className="relative z-10 flex items-center gap-1.5">
                  Start Free Trial
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
                {/* Shimmer */}
                <span className="absolute inset-0 -z-0 overflow-hidden rounded-md">
                  <span className="animate-shimmer absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-md" />
                </span>
              </Link>
            </Button>
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
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "visible" : "invisible"
        )}
      >
        {/* Backdrop */}
        <div
          className={cn(
            "absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />

        {/* Panel */}
        <div
          className={cn(
            "absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-950",
            mobileOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <Logo size={30} />
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded-lg p-2"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-slate-700 dark:text-slate-200" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {[
              { label: "Product", href: "/#features" },
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
                  "block border-b border-slate-50 py-3.5 text-base font-medium text-slate-800 transition-all dark:border-slate-800/50 dark:text-slate-200",
                  mobileOpen
                    ? "translate-x-0 opacity-100"
                    : "translate-x-4 opacity-0"
                )}
                style={{ transitionDelay: mobileOpen ? `${i * 50 + 100}ms` : "0ms" }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 p-5 dark:border-slate-800">
            <Button variant="outline" asChild>
              <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up" onClick={() => setMobileOpen(false)}>
                Start Free Trial
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors after:absolute after:bottom-1 after:left-3 after:h-0.5 after:w-[calc(100%-1.5rem)] after:origin-left after:scale-x-0 after:rounded-full after:bg-blue-600 after:transition-transform after:duration-300 hover:text-slate-900 hover:after:scale-x-100 dark:text-slate-300 dark:hover:text-white"
    >
      {children}
    </Link>
  );
}
