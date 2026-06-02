"use client";

import { FileText, X, RefreshCw, Globe, FileWarning } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { DocumentStatusBadge } from "./document-status-badge";
import { cn, formatBytes } from "@/lib/utils";
import type { UploadedDocument } from "@/hooks/use-file-upload";

const LANGUAGE_LABELS: Record<string, string> = {
  ENGLISH: "English",
  ARABIC: "Arabic / عربي",
  BILINGUAL: "Bilingual / ثنائي اللغة",
  UNKNOWN: "Unknown",
};

const MIME_ICON_COLORS: Record<string, string> = {
  "application/pdf": "text-red-500",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "text-blue-500",
  "application/msword": "text-blue-500",
  "text/plain": "text-slate-500",
};

interface UploadedDocumentsProps {
  documents: UploadedDocument[];
  onRemove: (filename: string) => void;
  onRetry?: (filename: string) => void;
  className?: string;
}

export function UploadedDocuments({
  documents,
  onRemove,
  onRetry,
  className,
}: UploadedDocumentsProps) {
  if (documents.length === 0) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Uploaded Documents ({documents.length})
      </h4>

      <div className="flex flex-col gap-2">
        {documents.map((doc) => (
          <DocumentItem
            key={doc.filename}
            doc={doc}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
}

function DocumentItem({
  doc,
  onRemove,
  onRetry,
}: {
  doc: UploadedDocument;
  onRemove: (filename: string) => void;
  onRetry?: (filename: string) => void;
}) {
  const iconColor = MIME_ICON_COLORS[doc.mimeType] ?? "text-slate-400";
  const isActive =
    doc.status === "uploading" || doc.status === "processing";
  const isFailed = doc.status === "failed";
  const isReady = doc.status === "ready";

  // Calculate total progress:
  // - Uploading: 0-50% (upload progress mapped to 0-50)
  // - Processing: 50-100% (processing progress mapped to 50-100)
  const totalProgress =
    doc.status === "uploading"
      ? doc.progress / 2
      : doc.status === "processing" || isReady
      ? 50 + doc.processingProgress / 2
      : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
        isFailed
          ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10"
          : isReady
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-900/10"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      )}
    >
      <div className="flex items-start gap-3">
        {/* File icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800">
          {isFailed ? (
            <FileWarning className="h-4 w-4 text-red-500" />
          ) : (
            <FileText className={cn("h-4 w-4", iconColor)} />
          )}
        </div>

        {/* File info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-200">
              {doc.filename}
            </p>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              {isFailed && onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onRetry(doc.filename)}
                  title="Retry upload"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              {!isActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-slate-400 hover:text-red-500"
                  onClick={() => onRemove(doc.filename)}
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="mt-0.5 flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">
              {formatBytes(doc.fileSizeBytes)}
            </span>

            <DocumentStatusBadge
              status={doc.status}
              progress={doc.progress}
            />

            {/* Language detected */}
            {isReady && doc.language && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Globe className="h-3 w-3" />
                {LANGUAGE_LABELS[doc.language] ?? doc.language}
              </span>
            )}

            {/* Page count */}
            {isReady && doc.pageCount && (
              <span className="text-xs text-slate-500">
                {doc.pageCount} {doc.pageCount === 1 ? "page" : "pages"}
              </span>
            )}
          </div>

          {/* Error message */}
          {isFailed && doc.errorMessage && (
            <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
              {doc.errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isActive && (
        <Progress
          value={totalProgress}
          className="h-1.5"
        />
      )}
    </div>
  );
}
