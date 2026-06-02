"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
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
import { updateWorkspace } from "@/lib/actions/workspace";
import { SECTORS } from "@/lib/constants";
import type { Organization } from "@prisma/client";

const schema = z.object({
  name: z.string().min(2, "At least 2 characters").max(100),
  nameAr: z.string().max(100).optional(),
  industry: z.string().optional(),
  website: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  defaultLanguage: z.enum(["EN", "AR", "AR_SA", "AR_AE", "AR_EG", "BILINGUAL"]),
  countryCode: z.string().length(2).or(z.literal("")).optional(),
});

type FormValues = z.infer<typeof schema>;

const COUNTRIES = [
  { code: "AE", label: "🇦🇪 United Arab Emirates" },
  { code: "SA", label: "🇸🇦 Saudi Arabia" },
  { code: "QA", label: "🇶🇦 Qatar" },
  { code: "KW", label: "🇰🇼 Kuwait" },
  { code: "BH", label: "🇧🇭 Bahrain" },
  { code: "OM", label: "🇴🇲 Oman" },
  { code: "EG", label: "🇪🇬 Egypt" },
  { code: "JO", label: "🇯🇴 Jordan" },
  { code: "GB", label: "🇬🇧 United Kingdom" },
  { code: "US", label: "🇺🇸 United States" },
];

const LANGUAGE_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "AR", label: "Arabic (Modern Standard)" },
  { value: "AR_SA", label: "Arabic (Saudi Arabia)" },
  { value: "AR_AE", label: "Arabic (UAE)" },
  { value: "AR_EG", label: "Arabic (Egypt)" },
  { value: "BILINGUAL", label: "Bilingual (Arabic + English)" },
];

interface WorkspaceFormProps {
  org: Organization;
  canEdit: boolean;
}

export function WorkspaceForm({ org, canEdit }: WorkspaceFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: org.name,
      nameAr: org.nameAr ?? "",
      industry: org.industry ?? "",
      website: org.website ?? "",
      defaultLanguage: (org.defaultLanguage as FormValues["defaultLanguage"]) ?? "EN",
      countryCode: org.countryCode ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateWorkspace(values);
      if (result.success) {
        toast({
          title: "Workspace updated",
          description: "Your changes have been saved.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Something went wrong.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Organization name */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Organization Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Acme Contracting Co."
            disabled={!canEdit || isPending}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nameAr">
            Organization Name (Arabic){" "}
            <span className="text-slate-400 text-xs">(optional)</span>
          </Label>
          <Input
            id="nameAr"
            placeholder="شركة أكمي للمقاولات"
            dir="rtl"
            disabled={!canEdit || isPending}
            style={{ fontFamily: "'IBM Plex Sans Arabic', system-ui, sans-serif" }}
            {...register("nameAr")}
          />
        </div>
      </div>

      {/* Industry + Country */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Industry</Label>
          <Select
            defaultValue={org.industry ?? ""}
            onValueChange={(val) => setValue("industry", val, { shouldDirty: true })}
            disabled={!canEdit || isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
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

        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select
            defaultValue={org.countryCode ?? ""}
            onValueChange={(val) =>
              setValue("countryCode", val, { shouldDirty: true })
            }
            disabled={!canEdit || isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Default language */}
      <div className="space-y-1.5">
        <Label>Default Proposal Language</Label>
        <p className="text-xs text-slate-500">
          Used as the default language when creating new proposals and generating AI content.
        </p>
        <Select
          defaultValue={org.defaultLanguage}
          onValueChange={(val) =>
            setValue("defaultLanguage", val as FormValues["defaultLanguage"], {
              shouldDirty: true,
            })
          }
          disabled={!canEdit || isPending}
        >
          <SelectTrigger className="max-w-xs">
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

      {/* Website */}
      <div className="space-y-1.5">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          type="url"
          placeholder="https://yourcompany.com"
          disabled={!canEdit || isPending}
          {...register("website")}
        />
        {errors.website && (
          <p className="text-xs text-red-500">{errors.website.message}</p>
        )}
      </div>

      {/* Save */}
      {canEdit && (
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={!isDirty || isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
          {isDirty && (
            <p className="text-xs text-slate-500">You have unsaved changes</p>
          )}
        </div>
      )}

      {!canEdit && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          You need Admin or Owner access to modify workspace settings.
        </p>
      )}
    </form>
  );
}
