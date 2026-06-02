import {
  Organization,
  Member,
  Tender,
  Document,
  Requirement,
  ComplianceMatrixRow,
  Proposal,
  ProposalSection,
  ProposalVersion,
  ContentLibraryItem,
  ProposalComment,
  ExportJob,
  AIJob,
  Subscription,
  AuditLog,
  MemberRole,
  TenderStatus,
  DocumentStatus,
  DocumentLanguage,
  RequirementType,
  RequirementPriority,
  ComplianceStatus,
  ProposalStatus,
  SectionType,
  ExportFormat,
  JobStatus,
  AIJobType,
  ContentLanguage,
  ContentSource,
  PlanTier,
} from "@prisma/client";

// Re-export all Prisma types for convenience
export type {
  Organization,
  Member,
  Tender,
  Document,
  Requirement,
  ComplianceMatrixRow,
  Proposal,
  ProposalSection,
  ProposalVersion,
  ContentLibraryItem,
  ProposalComment,
  ExportJob,
  AIJob,
  Subscription,
  AuditLog,
  MemberRole,
  TenderStatus,
  DocumentStatus,
  DocumentLanguage,
  RequirementType,
  RequirementPriority,
  ComplianceStatus,
  ProposalStatus,
  SectionType,
  ExportFormat,
  JobStatus,
  AIJobType,
  ContentLanguage,
  ContentSource,
  PlanTier,
};

// ── Rich types (Prisma models with relations) ─────────────────────────────────

export type TenderWithDetails = Tender & {
  createdBy: Pick<Member, "id" | "name" | "avatarUrl">;
  assignedManager: Pick<Member, "id" | "name" | "avatarUrl"> | null;
  _count: {
    documents: number;
    requirements: number;
    proposals: number;
  };
};

export type TenderWithCompliance = Tender & {
  complianceRows: (ComplianceMatrixRow & {
    requirement: Requirement;
  })[];
};

export type ProposalWithSections = Proposal & {
  sections: ProposalSection[];
  tender: Pick<Tender, "id" | "titleEn" | "titleAr" | "referenceNo">;
  createdBy: Pick<Member, "id" | "name" | "avatarUrl">;
};

export type ProposalSectionWithComments = ProposalSection & {
  comments: (ProposalComment & {
    createdBy: Pick<Member, "id" | "name" | "avatarUrl">;
    replies: ProposalComment[];
  })[];
  assignedTo: Pick<Member, "id" | "name" | "avatarUrl"> | null;
};

export type MemberWithOrg = Member & {
  organization: Pick<Organization, "id" | "name" | "slug" | "planTier" | "logoUrl">;
};

// ── API response types ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AIJobRef {
  jobId: string;
  status: JobStatus;
  estimatedSeconds?: number;
}

// ── Form types ────────────────────────────────────────────────────────────────

export interface CreateTenderInput {
  titleEn: string;
  titleAr?: string;
  referenceNo?: string;
  clientName?: string;
  clientNameAr?: string;
  clientCountry?: string;
  sector?: string;
  tenderType?: string;
  submissionDeadline?: Date;
  estimatedValue?: number;
  currency?: string;
  primaryLanguage: ContentLanguage;
  tags?: string[];
  notes?: string;
  assignedManagerId?: string;
}

export interface UpdateTenderInput extends Partial<CreateTenderInput> {
  status?: TenderStatus;
  lossReason?: string;
  outcomeNotes?: string;
}

export interface CreateProposalInput {
  title: string;
  language: ContentLanguage;
}

export interface UpdateSectionInput {
  titleEn?: string;
  titleAr?: string;
  contentEn?: string;
  contentAr?: string;
  orderIndex?: number;
  assignedToId?: string | null;
}

export interface CreateLibraryItemInput {
  titleEn: string;
  titleAr?: string;
  contentEn?: string;
  contentAr?: string;
  sectionType?: SectionType;
  tags?: string[];
  language?: ContentLanguage;
  isTemplate?: boolean;
}

export interface AIGenerateSectionInput {
  sectionId: string;
  sectionType: SectionType;
  tenderId: string;
  language: ContentLanguage;
  tone?: "formal_government" | "technical" | "professional" | "concise";
  additionalContext?: string;
}

// ── Compliance types ──────────────────────────────────────────────────────────

export interface ComplianceScore {
  score: number;         // 0–100
  total: number;         // Total requirements
  completed: number;     // Completed responses
  gaps: number;          // Not started mandatory requirements
  byPriority: {
    CRITICAL: { total: number; completed: number };
    HIGH: { total: number; completed: number };
    MEDIUM: { total: number; completed: number };
    LOW: { total: number; completed: number };
  };
}

// ── Workspace context (from Clerk + DB) ───────────────────────────────────────

export interface WorkspaceContext {
  org: Organization;
  member: Member;
  subscription: Subscription | null;
  canUpload: boolean;
  canCreateProposal: boolean;
  canUseAI: boolean;
  remainingAICredits: number;
  remainingProposals: number;
}

// ── Upload types ──────────────────────────────────────────────────────────────

export interface UploadedFile {
  storageKey: string;
  filename: string;
  mimeType: string;
  fileSizeBytes: number;
  url: string;
}

export interface PresignedUploadData {
  uploadUrl: string;
  storageKey: string;
  fields?: Record<string, string>;
}
