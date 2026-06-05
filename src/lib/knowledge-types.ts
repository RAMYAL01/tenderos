/**
 * Knowledge Brain categories — shared by server actions and client UI.
 *
 * NOTE: This is a plain module (NOT "use server"). A "use server" file may only
 * export async functions, so constants like these must live outside it, or
 * importing them into a Client Component crashes the page at module load.
 */

export const KNOWLEDGE_TYPES = [
  "case_study",
  "past_performance",
  "cv",
  "company_profile",
  "certification",
  "iso_document",
  "sop",
  "technical_report",
  "other",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  case_study: "Case Study",
  past_performance: "Past Performance",
  cv: "CV / Resume",
  company_profile: "Company Profile",
  certification: "Certification",
  iso_document: "ISO Document",
  sop: "SOP",
  technical_report: "Technical Report",
  other: "Other",
};
