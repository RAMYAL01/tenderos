"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

/**
 * Dashboard-level error boundary.
 * Renders inside the sidebar layout, so the sidebar stays visible.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>

        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Something went wrong
        </h2>
        <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">
          This page encountered an error. Your data is safe.
        </p>
        {error.digest && (
          <p className="mb-6 font-mono text-xs text-slate-400">
            Ref: {error.digest}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <Button size="sm" onClick={reset} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <details className="mt-6 rounded border border-red-200 bg-red-50 p-3 text-left text-xs dark:border-red-900/50 dark:bg-red-900/10">
            <summary className="cursor-pointer font-medium text-red-600 dark:text-red-400">
              Dev: error details
            </summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap text-red-600 dark:text-red-400">
              {error.message}{"\n\n"}{error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
