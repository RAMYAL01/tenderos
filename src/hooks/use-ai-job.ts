"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type AIJobStatus =
  | "idle"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AIJobState {
  jobId: string | null;
  status: AIJobStatus;
  progress: number;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  costUsd: number | null;
  latencyMs: number | null;
}

interface UseAIJobOptions {
  onComplete?: (result: Record<string, unknown> | null) => void;
  onError?: (error: string) => void;
  pollIntervalMs?: number;
}

/**
 * Hook to trigger an AI job and poll until completion.
 *
 * Usage:
 *   const { run, state, isRunning } = useAIJob({
 *     onComplete: (result) => console.log("Done!", result),
 *   });
 *
 *   await run(() => fetch("/api/ai/extract-requirements", { ... }));
 */
export function useAIJob(opts: UseAIJobOptions = {}) {
  const { onComplete, onError, pollIntervalMs = 2000 } = opts;

  const [state, setState] = useState<AIJobState>({
    jobId: null,
    status: "idle",
    progress: 0,
    result: null,
    errorMessage: null,
    costUsd: null,
    latencyMs: null,
  });

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const jobIdRef = useRef<string | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/ai/jobs/${jobId}`);
        if (!res.ok) return;

        const data = await res.json();

        setState((prev) => ({
          ...prev,
          status: data.status as AIJobStatus,
          progress: data.progress ?? prev.progress,
          result: data.result ?? prev.result,
          errorMessage: data.errorMessage ?? null,
          costUsd: data.costUsd ?? null,
          latencyMs: data.latencyMs ?? null,
        }));

        if (data.status === "COMPLETED") {
          stopPolling();
          onComplete?.(data.result);
        } else if (data.status === "FAILED" || data.status === "CANCELLED") {
          stopPolling();
          onError?.(data.errorMessage ?? "Job failed");
        }
      } catch {
        // Network error — keep polling
      }
    },
    [onComplete, onError]
  );

  /**
   * Start an AI job.
   * @param triggerFn - async function that calls the AI API and returns { jobId }
   */
  const run = useCallback(
    async (triggerFn: () => Promise<Response>) => {
      stopPolling();
      setState({
        jobId: null,
        status: "QUEUED",
        progress: 0,
        result: null,
        errorMessage: null,
        costUsd: null,
        latencyMs: null,
      });

      try {
        const res = await triggerFn();
        const data = await res.json();

        if (!res.ok) {
          setState((prev) => ({
            ...prev,
            status: "FAILED",
            errorMessage: data.error ?? "Failed to start job",
          }));
          onError?.(data.error ?? "Failed to start job");
          return;
        }

        const jobId = data.jobId;
        jobIdRef.current = jobId;
        setState((prev) => ({ ...prev, jobId, status: "QUEUED" }));

        // Start polling
        pollRef.current = setInterval(() => pollJob(jobId), pollIntervalMs);
        await pollJob(jobId); // Immediate first poll
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setState((prev) => ({ ...prev, status: "FAILED", errorMessage: msg }));
        onError?.(msg);
      }
    },
    [pollJob, pollIntervalMs, onError]
  );

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  return {
    state,
    run,
    isRunning:
      state.status === "QUEUED" || state.status === "PROCESSING",
    isComplete: state.status === "COMPLETED",
    isFailed: state.status === "FAILED",
    reset: () => {
      stopPolling();
      setState({
        jobId: null,
        status: "idle",
        progress: 0,
        result: null,
        errorMessage: null,
        costUsd: null,
        latencyMs: null,
      });
    },
  };
}
