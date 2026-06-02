"use client";

import { useState, useCallback, useRef } from "react";

export type UploadStatus =
  | "idle"
  | "requesting-url"
  | "uploading"
  | "confirming"
  | "processing"
  | "ready"
  | "failed";

export interface UploadedDocument {
  documentId: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  status: UploadStatus;
  progress: number;         // 0-100 (upload progress)
  processingProgress: number; // 0-100 (processing progress)
  errorMessage?: string;
  language?: string;
  pageCount?: number;
}

interface UseFileUploadOptions {
  tenderId: string;
  onComplete?: (doc: UploadedDocument) => void;
  onError?: (filename: string, error: string) => void;
}

/**
 * Hook that manages the full file upload lifecycle:
 * 1. Request presigned S3 URL from our API
 * 2. Upload directly to S3 via XHR (for progress tracking)
 * 3. Confirm upload with our API (creates DB record + triggers processing)
 * 4. Poll status until document is READY or FAILED
 */
export function useFileUpload({
  tenderId,
  onComplete,
  onError,
}: UseFileUploadOptions) {
  const [uploads, setUploads] = useState<Map<string, UploadedDocument>>(
    new Map()
  );

  // Track polling intervals so we can clean them up
  const pollingRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  function updateUpload(key: string, updates: Partial<UploadedDocument>) {
    setUploads((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) next.set(key, { ...existing, ...updates });
      return next;
    });
  }

  /**
   * Start polling the status of a document.
   * Polls every 2 seconds until status is READY or FAILED.
   */
  function startPolling(documentId: string, filename: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/status`);
        if (!res.ok) return;

        const data = await res.json();

        updateUpload(filename, {
          processingProgress: data.progress ?? 0,
          language: data.languageDetected,
          pageCount: data.pageCount,
          errorMessage: data.errorMessage,
        });

        if (data.status === "READY") {
          clearInterval(interval);
          pollingRefs.current.delete(documentId);
          const upload = { ...uploads.get(filename)! };
          upload.status = "ready";
          upload.processingProgress = 100;
          updateUpload(filename, { status: "ready", processingProgress: 100 });
          onComplete?.({ ...upload, documentId, status: "ready", processingProgress: 100 });
        } else if (data.status === "FAILED") {
          clearInterval(interval);
          pollingRefs.current.delete(documentId);
          updateUpload(filename, {
            status: "failed",
            errorMessage: data.errorMessage ?? "Processing failed",
          });
          onError?.(filename, data.errorMessage ?? "Processing failed");
        }
      } catch {
        // Network error — keep polling
      }
    }, 2000);

    pollingRefs.current.set(documentId, interval);
  }

  const uploadFile = useCallback(
    async (file: File, isPrimary = false) => {
      const filename = file.name;

      // Initialize upload state
      setUploads((prev) => {
        const next = new Map(prev);
        next.set(filename, {
          documentId: "",
          filename,
          fileSizeBytes: file.size,
          mimeType: file.type,
          status: "requesting-url",
          progress: 0,
          processingProgress: 0,
        });
        return next;
      });

      try {
        // ── Step 1: Get presigned upload URL ──────────────────────────────────
        updateUpload(filename, { status: "requesting-url" });

        const urlRes = await fetch("/api/documents/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenderId,
            filename,
            mimeType: file.type,
            fileSizeBytes: file.size,
          }),
        });

        if (!urlRes.ok) {
          const { error } = await urlRes.json();
          throw new Error(error ?? "Failed to get upload URL");
        }

        const { uploadUrl, storageKey } = await urlRes.json();

        // ── Step 2: Upload directly to S3 via XHR (for progress) ──────────────
        updateUpload(filename, { status: "uploading", progress: 0 });

        await uploadToS3WithProgress(
          uploadUrl,
          file,
          (progress) => updateUpload(filename, { progress })
        );

        updateUpload(filename, { progress: 100 });

        // ── Step 3: Confirm upload → creates DB record + triggers processing ───
        updateUpload(filename, { status: "confirming" });

        const confirmRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenderId,
            storageKey,
            filename,
            mimeType: file.type,
            fileSizeBytes: file.size,
            isPrimary,
          }),
        });

        if (!confirmRes.ok) {
          const { error } = await confirmRes.json();
          throw new Error(error ?? "Failed to confirm upload");
        }

        const { documentId } = await confirmRes.json();

        // ── Step 4: Start polling for processing status ────────────────────────
        updateUpload(filename, {
          documentId,
          status: "processing",
          processingProgress: 10,
        });

        startPolling(documentId, filename);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed";
        updateUpload(filename, { status: "failed", errorMessage: message });
        onError?.(filename, message);
      }
    },
    [tenderId, onComplete, onError]
  );

  function removeUpload(filename: string) {
    setUploads((prev) => {
      const next = new Map(prev);
      const doc = next.get(filename);
      if (doc?.documentId) {
        const interval = pollingRefs.current.get(doc.documentId);
        if (interval) {
          clearInterval(interval);
          pollingRefs.current.delete(doc.documentId);
        }
      }
      next.delete(filename);
      return next;
    });
  }

  function clearAll() {
    pollingRefs.current.forEach((interval) => clearInterval(interval));
    pollingRefs.current.clear();
    setUploads(new Map());
  }

  return {
    uploads: Array.from(uploads.values()),
    uploadFile,
    removeUpload,
    clearAll,
    hasActiveUploads: Array.from(uploads.values()).some(
      (u) => u.status === "uploading" || u.status === "processing"
    ),
    allReady: uploads.size > 0 && Array.from(uploads.values()).every(
      (u) => u.status === "ready"
    ),
  };
}

/**
 * Upload a file to a presigned S3 URL using XHR.
 * XHR is used (over fetch) because it supports upload progress events.
 */
function uploadToS3WithProgress(
  presignedUrl: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}
