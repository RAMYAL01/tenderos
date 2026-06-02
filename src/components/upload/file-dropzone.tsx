"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, FileText, AlertTriangle } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from "@/lib/s3";

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
}

const ACCEPT_ATTR =
  ".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain";

/**
 * Drag-and-drop file upload zone.
 * Validates file type and size before calling onFilesSelected.
 */
export function FileDropzone({
  onFilesSelected,
  disabled = false,
  multiple = true,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateFiles(files: File[]): {
    valid: File[];
    errors: string[];
  } {
    const valid: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        errors.push(`"${file.name}" is not a supported file type (PDF, DOCX, TXT only)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(
          `"${file.name}" is too large (${formatBytes(file.size)}). Max 50 MB.`
        );
        continue;
      }
      valid.push(file);
    }

    return { valid, errors };
  }

  const handleFiles = useCallback(
    (files: File[]) => {
      setDragError(null);
      const { valid, errors } = validateFiles(files);
      if (errors.length > 0) {
        setDragError(errors.join(". "));
      }
      if (valid.length > 0) {
        onFilesSelected(valid);
      }
    },
    [onFilesSelected]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      handleFiles(multiple ? files : files.slice(0, 1));
    },
    [disabled, multiple, handleFiles]
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      handleFiles(files);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleFiles]
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload documents"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            inputRef.current?.click();
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-12 text-center transition-all duration-200",
          isDragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600",
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "cursor-pointer"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPT_ATTR}
          multiple={multiple}
          disabled={disabled}
          onChange={onInputChange}
        />

        {/* Icon */}
        <div
          className={cn(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors",
            isDragging
              ? "bg-blue-100 dark:bg-blue-900/40"
              : "bg-slate-100 dark:bg-slate-800"
          )}
        >
          {isDragging ? (
            <FileText className="h-7 w-7 text-blue-600" />
          ) : (
            <Upload className="h-7 w-7 text-slate-400" />
          )}
        </div>

        {/* Text */}
        {isDragging ? (
          <p className="text-base font-medium text-blue-600">
            Drop files to upload
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              <span className="text-blue-600">Click to upload</span>
              {" "}or drag and drop
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              PDF, DOCX, DOC, TXT — up to 50 MB each
            </p>
            {/* Arabic hint */}
            <p
              className="mt-1 text-xs text-slate-400"
              dir="rtl"
              style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
            >
              ملفات PDF و DOCX — بالعربية والإنجليزية
            </p>
          </>
        )}
      </div>

      {/* Validation error */}
      {dragError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{dragError}</p>
        </div>
      )}
    </div>
  );
}
