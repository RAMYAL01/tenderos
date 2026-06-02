"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

/**
 * Root-level error boundary (outside the dashboard layout).
 * Catches errors not caught by nested error.tsx files.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error);
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        {/* Heading */}
        <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Something went wrong
        </h1>
        <p className="mb-2 text-slate-600 dark:text-slate-400">
          An unexpected error occurred. Our team has been notified.
        </p>

        {/* Error digest (for support reference) */}
        {error.digest && (
          <p className="mb-6 font-mono text-xs text-slate-400">
            Reference: {error.digest}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {/* Dev mode: show error details */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-900/50 dark:bg-red-900/10">
            <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-400">
              Error details (dev only)
            </summary>
            <pre className="mt-2 overflow-auto text-xs text-red-600 dark:text-red-400">
              {error.message}
              {"\n\n"}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
