import type { DocumentLanguage } from "@prisma/client";

/**
 * Arabic Unicode block ranges.
 * Covers: Arabic, Arabic Supplement, Arabic Extended-A,
 *         Arabic Presentation Forms-A and -B.
 */
const ARABIC_REGEX = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;

/**
 * Detect the primary language of a text document.
 *
 * Strategy:
 * - Count Arabic script characters (U+0600–U+06FF range)
 * - Calculate Arabic ratio vs. total alphabetic characters
 * - Thresholds: >60% Arabic → Arabic, 10-60% → Bilingual, <10% → English
 *
 * This is a fast heuristic that works well for procurement documents
 * where Arabic and English are the only two languages.
 */
export function detectLanguage(text: string): DocumentLanguage {
  if (!text || text.trim().length === 0) return "UNKNOWN";

  // Count Arabic characters
  const arabicMatches = text.match(ARABIC_REGEX) ?? [];
  const arabicCount = arabicMatches.length;

  // Count Latin alphabetic characters (a-z, A-Z)
  const latinMatches = text.match(/[a-zA-Z]/g) ?? [];
  const latinCount = latinMatches.length;

  const totalAlpha = arabicCount + latinCount;
  if (totalAlpha === 0) return "UNKNOWN";

  const arabicRatio = arabicCount / totalAlpha;

  if (arabicRatio >= 0.6) return "ARABIC";
  if (arabicRatio >= 0.1) return "BILINGUAL";
  return "ENGLISH";
}

/**
 * Detect language of a specific page within a document.
 */
export function detectPageLanguage(
  pageText: string
): "ARABIC" | "ENGLISH" | "BILINGUAL" | "UNKNOWN" {
  return detectLanguage(pageText);
}

/**
 * Calculate language confidence score (0.0–1.0).
 *
 * Returns how confident we are in the detected language.
 * High confidence: >80% of characters are in one script.
 * Low confidence: near 50/50 split.
 */
export function getLanguageConfidence(
  text: string,
  detectedLanguage: DocumentLanguage
): number {
  if (detectedLanguage === "UNKNOWN") return 0;
  if (detectedLanguage === "BILINGUAL") {
    // For bilingual, confidence is lower by definition
    return 0.65;
  }

  const arabicMatches = text.match(ARABIC_REGEX) ?? [];
  const arabicCount = arabicMatches.length;
  const latinMatches = text.match(/[a-zA-Z]/g) ?? [];
  const latinCount = latinMatches.length;
  const totalAlpha = arabicCount + latinCount;

  if (totalAlpha === 0) return 0;

  const arabicRatio = arabicCount / totalAlpha;

  if (detectedLanguage === "ARABIC") return Math.min(1, arabicRatio + 0.1);
  if (detectedLanguage === "ENGLISH") return Math.min(1, 1 - arabicRatio + 0.1);

  return 0.5;
}

/**
 * Procurement-specific terminology lists.
 * Used to boost language detection confidence for short texts.
 */
const ARABIC_PROCUREMENT_TERMS = [
  "مناقصة",    // tender
  "عطاء",      // bid
  "طلب عروض",  // RFP
  "نطاق العمل", // scope of work
  "مواصفات",   // specifications
  "الامتثال",   // compliance
  "شروط",      // terms
  "متطلبات",   // requirements
  "العرض الفني", // technical proposal
  "العرض المالي", // financial proposal
];

/**
 * Check if the text contains Arabic procurement terminology.
 * Returns true if 2+ procurement terms are found.
 */
export function containsArabicProcurementTerms(text: string): boolean {
  let found = 0;
  for (const term of ARABIC_PROCUREMENT_TERMS) {
    if (text.includes(term)) {
      found++;
      if (found >= 2) return true;
    }
  }
  return false;
}
