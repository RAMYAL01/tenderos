"use client";

import { useState } from "react";
import {
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Download,
  Globe,
  FileWarning,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { UploadedDocuments } from "@/components/upload/uploaded-documents";
import { useFileUpload } from "@/hooks/use-file-upload";
import { toast } from "@/hooks/use-toast";
import { formatBytes, cn } from "@/lib/utils";
import { format } from "date-fns";

interface DocumentRecord {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: bigint;
  processingStatus: string;
  languageDetected: string | null;
  extractionMethod: string | null;
  pageCount: number | null;
  isPrimary: boolean;
  errorMessage: string | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string; avatarUrl: string | null };
}

interface TenderDocumentsPanelProps {
  tenderId: string;
  orgId: string;
  initialDocuments: DocumentRecord[];
  memberRole: string;
}

const STATUS_STYLES: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDING:       { label: "Pending",     icon: Loader2,       color: "text-slate-400" },
  QUEUED:        { label: "Queued",      icon: Loader2,       color: "text-slate-400" },
  SCANNING:      { label: "Scanning",    icon: Loader2,       color: "text-blue-500" },
  OCR_PROCESSING: { label: "Processing", icon: Loader2,        color: "text-blue-500" },
  PARSING:       { label: "Parsing",     icon: Loader2,       color: "text-blue-500" },
  INDEXING:      { label: "Indexing",    icon: Loader2,       color: "text-violet-500" },
  READY:         { label: "Ready",       icon: CheckCircle2,  color: "text-emerald-600" },
  NEEDS_REVIEW:  { label: "Needs review", icon: AlertTriangle, color: "text-amber-600" },
  FAILED:        { label: "Failed",      icon: FileWarning,   color: "text-red-500" },
  QUARANTINED:   { label: "Quarantined", icon: FileWarning,   color: "text-red-600" },
};

const LANG_LABELS: Record<string, string> = {
  ENGLISH:   "English",
  ARABIC:    "Arabic",
  BILINGUAL: "Bilingual",
  UNKNOWN:   "Unknown",
};

export function TenderDocumentsPanel({
  tenderId,
  orgId,
  initialDocuments,
  memberRole,
}: TenderDocumentsPanelProps) {
  const [showUpload, setShowUpload] = useState(initialDocuments.length === 0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canUpload = ["OWNER", "ADMIN", "MANAGER", "SENIOR_WRITER", "WRITER"].includes(memberRole);

  const { uploads, uploadFile, removeUpload, hasActiveUploads } = useFileUpload({
    tenderId,
    onComplete: (doc) => {
      toast({
        title: "Document ready ✓",
        description: `"${doc.filename}" — ${doc.pageCount ?? "?"} pages, ${LANG_LABELS[doc.language ?? ""] ?? doc.language}`,
      });
      // Refresh the page to show new document in the existing list
      window.location.reload();
    },
    onError: (filename, error) => {
      toast({ title: `Failed: ${filename}`, description: error, variant: "destructive" });
    },
  });

  async function handleDelete(docId: string) {
    if (!confirm("Remove this document? This cannot be undone.")) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: "Document removed" });
      window.location.reload();
    } catch {
      toast({ title: "Failed to remove document", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(docId: string, filename: string) {
    try {
      const res = await fetch(`/api/documents/${docId}`);
      const data = await res.json();
      const a = document.createElement("a");
      a.href = data.downloadUrl;
      a.download = filename;
      a.click();
    } catch {
      toast({ title: "Failed to generate download link", variant: "destructive" });
    }
  }

  async function handleRetry(docId: string) {
    try {
      const res = await fetch(`/api/documents/${docId}/process`, { method: "PUT" });
      if (!res.ok) throw new Error("Retry failed");
      toast({ title: "Reprocessing started" });
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast({ title: "Failed to retry processing", variant: "destructive" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          Documents
          {initialDocuments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({initialDocuments.length})
            </span>
          )}
        </h3>
        {canUpload && !showUpload && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpload(true)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload More
          </Button>
        )}
      </div>

      {/* Upload zone */}
      {showUpload && canUpload && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <FileDropzone
            onFilesSelected={(files) => {
              const isPrimary = initialDocuments.length === 0 && uploads.length === 0;
              files.forEach((f, i) => uploadFile(f, isPrimary && i === 0));
            }}
            disabled={hasActiveUploads}
            multiple
          />

          {uploads.length > 0 && (
            <div className="mt-4">
              <UploadedDocuments documents={uploads} onRemove={removeUpload} />
            </div>
          )}

          {initialDocuments.length > 0 && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUpload(false)}
              >
                Close uploader
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Existing documents list */}
      {initialDocuments.length === 0 && uploads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 dark:border-slate-700">
          <FileText className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            No documents uploaded yet
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Upload the RFP/RFQ document to get started
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {initialDocuments.map((doc) => {
            const statusConfig =
              STATUS_STYLES[doc.processingStatus] ?? STATUS_STYLES.PENDING;
            const StatusIcon = statusConfig.icon;
            const isProcessing =
              !["READY", "FAILED", "QUARANTINED", "NEEDS_REVIEW"].includes(doc.processingStatus);

            return (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-start gap-4 rounded-xl border p-4 transition-colors",
                  doc.processingStatus === "FAILED"
                    ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-900/10"
                    : doc.processingStatus === "NEEDS_REVIEW"
                    ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-900/10"
                    : doc.processingStatus === "READY"
                    ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                    : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                )}
              >
                {/* File icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  {doc.processingStatus === "FAILED" ? (
                    <FileWarning className="h-5 w-5 text-red-500" />
                  ) : doc.processingStatus === "NEEDS_REVIEW" ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-slate-500" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="line-clamp-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {doc.originalFilename}
                    </p>
                    {doc.isPrimary && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {formatBytes(Number(doc.fileSizeBytes))}
                    </span>

                    <span
                      className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        statusConfig.color
                      )}
                    >
                      <StatusIcon
                        className={cn(
                          "h-3.5 w-3.5",
                          isProcessing && "animate-spin"
                        )}
                      />
                      {statusConfig.label}
                    </span>

                    {doc.languageDetected && doc.processingStatus === "READY" && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Globe className="h-3.5 w-3.5" />
                        {LANG_LABELS[doc.languageDetected] ?? doc.languageDetected}
                      </span>
                    )}

                    {(doc.extractionMethod === "azure-ocr" ||
                      doc.extractionMethod === "claude-ocr") && (
                      <span
                        className="flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400"
                        title="Scanned document — text recovered via OCR"
                      >
                        <ScanLine className="h-3.5 w-3.5" />
                        OCR
                      </span>
                    )}

                    {doc.pageCount && (
                      <span className="text-xs text-slate-500">
                        {doc.pageCount} pages
                      </span>
                    )}

                    <span className="text-xs text-slate-400">
                      by {doc.uploadedBy.name}
                    </span>
                  </div>

                  {doc.errorMessage && (
                    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                      {doc.errorMessage}
                    </p>
                  )}

                  {doc.processingStatus === "NEEDS_REVIEW" && !doc.errorMessage && (
                    <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                      Some pages were low-confidence and held for review. Verify the
                      extracted content before relying on it.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {(doc.processingStatus === "READY" ||
                    doc.processingStatus === "NEEDS_REVIEW") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(doc.id, doc.originalFilename)}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {doc.processingStatus === "FAILED" && canUpload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-500"
                      onClick={() => handleRetry(doc.id)}
                      title="Retry processing"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {canUpload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-500"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      title="Remove"
                    >
                      {deletingId === doc.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
