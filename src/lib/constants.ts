import { PlanTier, SectionType, TenderStatus, ComplianceStatus, ProposalStatus } from "@prisma/client";

// ── App ───────────────────────────────────────────────────────────────────────

export const APP_NAME = "TenderOS";
export const APP_DESCRIPTION = "The Operating System for Winning Contracts";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ── Plan limits ───────────────────────────────────────────────────────────────

export const PLAN_LIMITS: Record<
  PlanTier,
  {
    seats: number;
    proposalsPerMonth: number;
    aiCreditsPerMonth: number;
    storageBytesLimit: number;
    label: string;
    price: number; // USD/month
  }
> = {
  STARTER: {
    seats: 3,
    proposalsPerMonth: 5,
    aiCreditsPerMonth: 50,
    storageBytesLimit: 2 * 1024 * 1024 * 1024,   // 2 GB
    label: "Starter",
    price: 149,
  },
  PROFESSIONAL: {
    seats: 10,
    proposalsPerMonth: 20,
    aiCreditsPerMonth: 250,
    storageBytesLimit: 10 * 1024 * 1024 * 1024,  // 10 GB
    label: "Professional",
    price: 499,
  },
  BUSINESS: {
    seats: 30,
    proposalsPerMonth: 999_999,
    aiCreditsPerMonth: 1000,
    storageBytesLimit: 50 * 1024 * 1024 * 1024,  // 50 GB
    label: "Business",
    price: 1299,
  },
  ENTERPRISE: {
    seats: 999_999,
    proposalsPerMonth: 999_999,
    aiCreditsPerMonth: 999_999,
    storageBytesLimit: 999_999 * 1024 * 1024 * 1024,
    label: "Enterprise",
    price: 0,  // Custom
  },
};

// ── Upload limits ─────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
];
export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".txt"];

// ── S3 ────────────────────────────────────────────────────────────────────────

export const S3_DOCUMENT_PREFIX = "documents/";
export const S3_EXPORT_PREFIX = "exports/";
export const PRESIGNED_URL_EXPIRY = 15 * 60; // 15 minutes in seconds

// ── AI ────────────────────────────────────────────────────────────────────────

export const AI_MODELS = {
  // Primary: Claude for proposal generation (best quality)
  CLAUDE_SONNET: "claude-3-5-sonnet-20241022",
  CLAUDE_HAIKU: "claude-3-5-haiku-20241022",   // Fast + cheap for extractions
  // Secondary: OpenAI for embeddings
  OPENAI_EMBEDDING: "text-embedding-3-large",
  // GPT-4o as fallback
  GPT_4O: "gpt-4o",
  GPT_4O_MINI: "gpt-4o-mini",
} as const;

export const EMBEDDING_DIMENSIONS = 1536; // text-embedding-3-large output size

// Approximate cost per 1K tokens (USD) — for budget tracking
export const AI_COST_PER_1K_TOKENS = {
  [AI_MODELS.CLAUDE_SONNET]: { input: 0.003, output: 0.015 },
  [AI_MODELS.CLAUDE_HAIKU]:  { input: 0.001, output: 0.005 },
  [AI_MODELS.GPT_4O]:        { input: 0.0025, output: 0.01 },
  [AI_MODELS.GPT_4O_MINI]:   { input: 0.00015, output: 0.0006 },
} as const;

// ── Proposal sections (ordered) ───────────────────────────────────────────────

export const SECTION_TYPE_LABELS: Record<SectionType, { en: string; ar: string }> = {
  EXECUTIVE_SUMMARY:  { en: "Executive Summary",     ar: "الملخص التنفيذي" },
  COMPANY_OVERVIEW:   { en: "Company Overview",       ar: "نظرة عامة على الشركة" },
  TECHNICAL_APPROACH: { en: "Technical Approach",     ar: "المنهجية الفنية" },
  METHODOLOGY:        { en: "Methodology",             ar: "المنهجية" },
  WORK_PLAN:          { en: "Work Plan",               ar: "خطة العمل" },
  TEAM_QUALIFICATIONS: { en: "Team Qualifications",   ar: "مؤهلات الفريق" },
  PAST_PERFORMANCE:   { en: "Past Performance",        ar: "الأعمال السابقة" },
  EQUIPMENT_RESOURCES: { en: "Equipment & Resources", ar: "المعدات والموارد" },
  HEALTH_SAFETY:      { en: "Health, Safety & Environment", ar: "الصحة والسلامة والبيئة" },
  LOCAL_CONTENT:      { en: "Local Content / In-Country Value", ar: "المحتوى المحلي" },
  FINANCIAL_PROPOSAL: { en: "Financial Proposal",     ar: "العرض المالي" },
  CLARIFICATIONS:     { en: "Clarifications",          ar: "التوضيحات" },
  APPENDIX:           { en: "Appendix",                ar: "الملاحق" },
  COVER_LETTER:       { en: "Cover Letter",            ar: "خطاب التغطية" },
  CUSTOM:             { en: "Custom Section",          ar: "قسم مخصص" },
};

export const DEFAULT_SECTION_ORDER: SectionType[] = [
  "COVER_LETTER",
  "EXECUTIVE_SUMMARY",
  "COMPANY_OVERVIEW",
  "TECHNICAL_APPROACH",
  "METHODOLOGY",
  "WORK_PLAN",
  "TEAM_QUALIFICATIONS",
  "PAST_PERFORMANCE",
  "EQUIPMENT_RESOURCES",
  "LOCAL_CONTENT",
  "CLARIFICATIONS",
  "APPENDIX",
];

// ── Status labels ─────────────────────────────────────────────────────────────

export const TENDER_STATUS_LABELS: Record<TenderStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  SUBMITTED: "Submitted",
  WON: "Won",
  LOST: "Lost",
  NO_DECISION: "No Decision",
  CANCELLED: "Cancelled",
};

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NOT_APPLICABLE: "N/A",
  FLAGGED: "Flagged",
};

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In Review",
  CHANGES_REQUESTED: "Changes Requested",
  APPROVED: "Approved",
  EXPORTED: "Exported",
  ARCHIVED: "Archived",
};

// ── Pagination ────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ── Sectors ───────────────────────────────────────────────────────────────────

export const SECTORS = [
  { value: "construction", label: "Construction" },
  { value: "oil_gas", label: "Oil & Gas / Energy" },
  { value: "defense", label: "Defense & Security" },
  { value: "facilities", label: "Facilities Management" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "it", label: "Information Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "consulting", label: "Consulting & Advisory" },
  { value: "other", label: "Other" },
] as const;

// ── Tender types ──────────────────────────────────────────────────────────────

export const TENDER_TYPES = [
  { value: "RFP", label: "RFP — Request for Proposal" },
  { value: "RFQ", label: "RFQ — Request for Quotation" },
  { value: "ITB", label: "ITB — Invitation to Bid" },
  { value: "EOI", label: "EOI — Expression of Interest" },
  { value: "ITT", label: "ITT — Invitation to Tender" },
  { value: "RFI", label: "RFI — Request for Information" },
] as const;
