"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronRight, ChevronLeft, Loader2, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { UploadedDocuments } from "@/components/upload/uploaded-documents";
import { useFileUpload } from "@/hooks/use-file-upload";
import { createTender } from "@/lib/actions/tenders";
import { SECTORS, TENDER_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

// ── Form schema ────────────────────────────────────────────────────────────────

const TenderDetailsSchema = z.object({
  titleEn: z.string().min(3, "Title must be at least 3 characters"),
  titleAr: z.string().optional(),
  referenceNo: z.string().optional(),
  clientName: z.string().optional(),
  clientNameAr: z.string().optional(),
  tenderType: z.string().optional(),
  sector: z.string().optional(),
  submissionDeadline: z.string().optional(),
  primaryLanguage: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]),
  currency: z.string().default("USD"),
});

type TenderDetailsValues = z.infer<typeof TenderDetailsSchema>;

const STEPS = [
  { id: 1, label: "Tender Details" },
  { id: 2, label: "Upload Documents" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "AR", label: "Arabic (عربي)" },
  { value: "BILINGUAL", label: "Bilingual (EN + AR)" },
  { value: "AR_SA", label: "Arabic — Saudi" },
  { value: "AR_AE", label: "Arabic — UAE" },
  { value: "AR_EG", label: "Arabic — Egypt" },
];

/**
 * Multi-step tender creation form.
 *
 * Step 1: Fill in tender details → server action creates tender
 * Step 2: Upload RFP documents → redirect to tender detail page
 */
export function NewTenderForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [tenderId, setTenderId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TenderDetailsValues>({
    resolver: zodResolver(TenderDetailsSchema),
    defaultValues: {
      primaryLanguage: "EN",
      currency: "USD",
    },
  });

  const { uploads, uploadFile, removeUpload, hasActiveUploads, allReady } =
    useFileUpload({
      tenderId: tenderId ?? "",
      onComplete: (doc) => {
        toast({
          title: "Document ready",
          description: `"${doc.filename}" has been processed.`,
        });
      },
      onError: (filename, error) => {
        toast({
          title: "Processing failed",
          description: `"${filename}": ${error}`,
          variant: "destructive",
        });
      },
    });

  // ── Step 1: Create tender ─────────────────────────────────────────────────

  function onStep1Submit(values: TenderDetailsValues) {
    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createTender(values as any);

      if (result.success && result.tenderId) {
        setTenderId(result.tenderId);
        setStep(2);
      } else {
        toast({
          title: "Failed to create tender",
          description: result.error ?? "Please try again.",
          variant: "destructive",
        });
      }
    });
  }

  // ── Step 2: Handle file selection ────────────────────────────────────────

  function handleFilesSelected(files: File[]) {
    if (!tenderId) return;
    const isPrimary = uploads.length === 0;
    files.forEach((file, i) =>
      uploadFile(file, isPrimary && i === 0)
    );
  }

  function handleFinish() {
    if (tenderId) {
      router.push(`/tenders/${tenderId}`);
    }
  }

  function handleSkip() {
    if (tenderId) {
      router.push(`/tenders/${tenderId}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                step > s.id
                  ? "bg-emerald-600 text-white"
                  : step === s.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-400 dark:bg-slate-800"
              )}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                step === s.id
                  ? "text-slate-900 dark:text-slate-100"
                  : "text-slate-400"
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="mx-1 h-4 w-4 text-slate-300" />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Tender Details ─────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleSubmit(onStep1Submit)} className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-5 font-semibold text-slate-900 dark:text-slate-100">
              Tender Information
            </h3>

            {/* Title EN + AR */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="titleEn">
                  Title (English) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="titleEn"
                  placeholder="e.g. Design and Build of Wastewater Treatment Plant"
                  {...register("titleEn")}
                />
                {errors.titleEn && (
                  <p className="text-xs text-red-500">{errors.titleEn.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="titleAr">
                  Title (Arabic){" "}
                  <span className="text-xs text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="titleAr"
                  placeholder="مشروع محطة معالجة مياه الصرف"
                  dir="rtl"
                  style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
                  {...register("titleAr")}
                />
              </div>
            </div>

            {/* Reference + Client */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="referenceNo">Reference Number</Label>
                <Input
                  id="referenceNo"
                  placeholder="e.g. MOH-2025-0042"
                  {...register("referenceNo")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="Ministry of Health"
                  {...register("clientName")}
                />
              </div>
            </div>

            {/* Type + Sector */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tender Type</Label>
                <Select
                  onValueChange={(val) => setValue("tenderType", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TENDER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Sector</Label>
                <Select
                  onValueChange={(val) => setValue("sector", val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Deadline + Language */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="submissionDeadline">Submission Deadline</Label>
                <Input
                  id="submissionDeadline"
                  type="datetime-local"
                  {...register("submissionDeadline")}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Document Language</Label>
                <Select
                  defaultValue="EN"
                  onValueChange={(val) =>
                    setValue("primaryLanguage", val as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Next: Upload Documents
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* ── STEP 2: Upload Documents ──────────────────────────────────────── */}
      {step === 2 && tenderId && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Upload RFP / RFQ Documents
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Upload the tender documents (PDF or DOCX). Our AI will
                automatically extract all requirements after processing.
              </p>
            </div>

            <FileDropzone
              onFilesSelected={handleFilesSelected}
              disabled={hasActiveUploads}
              multiple
            />

            {uploads.length > 0 && (
              <div className="mt-5">
                <UploadedDocuments
                  documents={uploads}
                  onRemove={removeUpload}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep(1)}
              disabled={hasActiveUploads}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>

            <div className="flex gap-3">
              {uploads.length === 0 && (
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="text-slate-500"
                >
                  Skip for now
                </Button>
              )}

              <Button
                onClick={handleFinish}
                disabled={hasActiveUploads}
                className="gap-2"
              >
                {allReady ? (
                  <>
                    <Check className="h-4 w-4" />
                    Open Tender
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Go to Tender
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
