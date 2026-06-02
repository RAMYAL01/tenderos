"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global error boundary — catches errors in the root layout itself.
 * This is a last-resort catch; most errors are caught by nested error.tsx files.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          backgroundColor: "#0F172A",
          color: "#F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "480px", textAlign: "center" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: "28px",
            }}
          >
            ⚠
          </div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "700",
              marginBottom: "12px",
              color: "#F1F5F9",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: "#94A3B8", marginBottom: "8px" }}>
            TenderOS encountered an unexpected error.
          </p>
          {error.digest && (
            <p style={{ color: "#64748B", fontSize: "12px", marginBottom: "32px" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              backgroundColor: "#2563EB",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              marginRight: "12px",
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              color: "#94A3B8",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            Return to Dashboard →
          </a>
        </div>
      </body>
    </html>
  );
}
