import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** ShadCN utility — merges Tailwind classes safely. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes to human-readable string.
 * e.g. 2147483648 → "2 GB"
 */
export function formatBytes(bytes: number | bigint, decimals = 1): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Format a deadline date as "X days remaining" or "Overdue by X days".
 */
export function formatDeadline(date: Date | string | null): string {
  if (!date) return "No deadline";
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `${diffDays} days remaining`;
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

/**
 * Convert an enum value to a display label.
 * e.g. "NOT_STARTED" → "Not Started"
 */
export function enumToLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Generate a URL-safe slug from a string.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Safe JSON parse — returns null instead of throwing.
 */
export function safeJsonParse<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Get compliance score color class.
 */
export function complianceScoreColor(score: number): string {
  if (score >= 80) return "text-compliance-complete";
  if (score >= 60) return "text-compliance-progress";
  return "text-compliance-gap";
}

/**
 * Get compliance score badge variant.
 */
export function complianceScoreBadge(score: number): "success" | "warning" | "destructive" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "destructive";
}

/**
 * Format currency.
 */
export function formatCurrency(
  amount: number | string,
  currency = "USD",
  locale = "en-US"
): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Check if a value is an Arabic string (contains Arabic Unicode characters).
 */
export function isArabicText(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/**
 * Get text direction based on content.
 */
export function getTextDirection(text: string): "rtl" | "ltr" {
  return isArabicText(text) ? "rtl" : "ltr";
}
