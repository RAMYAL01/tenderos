"use client";

import { Component, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: { componentStack: string }) => void;
  /** Show a compact inline error (useful inside panels/widgets) */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Client-side error boundary for isolating section/widget errors.
 * Wraps individual components that might fail (AI panels, editors, etc.)
 * without crashing the whole page.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <AIAssistantPanel />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    this.props.onError?.(error, info);
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    if (this.props.inline) {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-900/10">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              Component error
            </p>
            {process.env.NODE_ENV === "development" && (
              <p className="mt-0.5 truncate text-xs text-red-500">
                {this.state.error?.message}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={this.handleReset}
            className="h-7 gap-1.5 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-900/10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <div>
          <p className="font-medium text-red-700 dark:text-red-400">
            This section encountered an error
          </p>
          {process.env.NODE_ENV === "development" && (
            <p className="mt-1 text-sm text-red-500">{this.state.error?.message}</p>
          )}
        </div>
        <Button size="sm" onClick={this.handleReset} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    );
  }
}
