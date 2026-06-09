"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "tos_cookie_consent"; // "all" | "essential"

/**
 * Lightweight, privacy-preserving cookie consent banner.
 * - Defaults to NO non-essential cookies until the user accepts.
 * - Choice persists in localStorage; the banner won't show again once set.
 * - Other code can read `window.localStorage.getItem("tos_cookie_consent")`
 *   (or listen for the `tos-consent-change` event) before loading analytics.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      /* storage blocked — don't nag */
    }
  }, []);

  function choose(choice: "all" | "essential") {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
      window.dispatchEvent(new CustomEvent("tos-consent-change", { detail: choice }));
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950">
            <Cookie className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            We use strictly necessary cookies to run TenderOS, and — only with your
            consent — a few analytics cookies to improve the product. See our{" "}
            <Link
              href="/privacy"
              className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="flex shrink-0 gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={() => choose("essential")}
            className="flex-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:flex-none"
          >
            Decline non-essential
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="flex-1 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 sm:flex-none"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
