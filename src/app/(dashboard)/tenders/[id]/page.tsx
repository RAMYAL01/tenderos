import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  Calendar,
  Building2,
  Globe,
  FileText,
  Upload,
  ChevronRight,
  Hash,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { TenderDocumentsPanel } from "@/components/tenders/tender-documents-panel";
import { BidDecisionCard, type BidDecisionData } from "@/components/tenders/bid-decision-card";
import { getAuthContext, hasRole } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { formatDeadline, cn } from "@/lib/utils";

export const metadata = { title: "Tender" };

const STATUS_STYLES: Record<string, string> = {
  DRAFT:       "bg-slate-100 text-slate-600",
  ACTIVE:      "bg-blue-100 text-blue-700",
  SUBMITTED:   "bg-violet-100 text-violet-700",
  WON:         "bg-emerald-100 text-emerald-700",
  LOST:        "bg-red-100 text-red-600",
  NO_DECISION: "bg-amber-100 text-amber-700",
  CANCELLED:   "bg-slate-100 text-slate-400",
};

export default async function TenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { org, member } = await getAuthContext();
  const { id } = await params;

  const tender = await db.tender.findFirst({
    where: { id, orgId: org.id, deletedAt: null },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      assignedManager: { select: { id: true, name: true, avatarUrl: true } },
      documents: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      _count: {
        select: { requirements: true, proposals: true },
      },
    },
  });

  if (!tender) notFound();

  // Bid/No-Bid analysis (org-scoped; decider name resolved server-side so the
  // card stays a fully-serializable client island).
  const bidDecisionRow = await db.bidDecision.findFirst({
    where: { tenderId: id, orgId: org.id },
  });
  const decidedBy = bidDecisionRow?.decidedById
    ? await db.member.findFirst({
        where: { id: bidDecisionRow.decidedById, orgId: org.id },
        select: { name: true },
      })
    : null;
  const bidDecision: BidDecisionData | null = bidDecisionRow
    ? {
        score: bidDecisionRow.score,
        baseScore: bidDecisionRow.baseScore,
        llmAdjustment: bidDecisionRow.llmAdjustment,
        confidence: bidDecisionRow.confidence,
        recommendation: bidDecisionRow.recommendation,
        factors: (bidDecisionRow.factors as Record<string, number>) ?? {},
        rationale: bidDecisionRow.rationale,
        rationaleAr: bidDecisionRow.rationaleAr,
        risks: (bidDecisionRow.risks as BidDecisionData["risks"]) ?? [],
        questionsToAsk: (bidDecisionRow.questionsToAsk as string[]) ?? [],
        // Prisma's enum includes REVIEW, but a human decision is only ever BID/NO_BID.
        humanDecision: bidDecisionRow.humanDecision as "BID" | "NO_BID" | null,
        decidedByName: decidedBy?.name ?? null,
        decidedAt: bidDecisionRow.decidedAt?.toISOString() ?? null,
        decisionNotes: bidDecisionRow.decisionNotes,
      }
    : null;

  const hasDocuments = tender.documents.length > 0;
  const readyDocuments = tender.documents.filter(
    (d) => d.processingStatus === "READY"
  );

  return (
    <>
      <PageHeader
        title={tender.titleEn}
        titleAr={tender.titleAr ?? undefined}
        description={[
          tender.referenceNo,
          tender.clientName,
          tender.tenderType,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        {/* Status badge */}
        <span
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
            STATUS_STYLES[tender.status]
          )}
        >
          {tender.status.replace("_", " ")}
        </span>

        {readyDocuments.length > 0 && tender._count.requirements === 0 && (
          <Button size="sm" asChild>
            <Link href={`/tenders/${id}/requirements`}>
              Extract Requirements →
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start">
        {/* ── Main: Documents ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <TenderDocumentsPanel
            tenderId={id}
            orgId={org.id}
            initialDocuments={tender.documents as any}
            memberRole={member.role}
          />
        </div>

        {/* ── Sidebar: Tender details ──────────────────────────────────── */}
        <aside className="w-full shrink-0 space-y-4 lg:w-72">
          {/* Bid/No-Bid qualification */}
          <BidDecisionCard
            tenderId={id}
            decision={bidDecision}
            canRun={hasRole(member.role, "WRITER")}
            canDecide={hasRole(member.role, "MANAGER")}
          />

          {/* Details card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tender Details
            </h3>

            <div className="space-y-3">
              {tender.submissionDeadline && (
                <div className="flex items-start gap-2.5">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Submission Deadline</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {format(new Date(tender.submissionDeadline), "dd MMM yyyy, HH:mm")}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        new Date(tender.submissionDeadline) < new Date()
                          ? "text-red-500"
                          : "text-slate-500"
                      )}
                    >
                      {formatDeadline(tender.submissionDeadline)}
                    </p>
                  </div>
                </div>
              )}

              {tender.tenderType && (
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Type</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      {tender.tenderType}
                    </p>
                  </div>
                </div>
              )}

              {tender.referenceNo && (
                <div className="flex items-center gap-2.5">
                  <Hash className="h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Reference</p>
                    <p className="font-mono text-sm text-slate-800 dark:text-slate-200">
                      {tender.referenceNo}
                    </p>
                  </div>
                </div>
              )}

              {tender.clientName && (
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Client</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200">
                      {tender.clientName}
                    </p>
                    {tender.clientNameAr && (
                      <p
                        className="text-xs text-slate-500"
                        dir="rtl"
                        style={{
                          fontFamily:
                            "'IBM Plex Sans Arabic', system-ui, sans-serif",
                        }}
                      >
                        {tender.clientNameAr}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Primary Language</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    {tender.primaryLanguage === "EN"
                      ? "English"
                      : tender.primaryLanguage === "AR"
                      ? "Arabic"
                      : "Bilingual"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              Progress
            </h3>
            <div className="space-y-2">
              {[
                { label: "Documents", value: hasDocuments, count: tender.documents.length },
                { label: "Requirements extracted", value: tender._count.requirements > 0, count: tender._count.requirements },
                { label: "Proposals drafted", value: tender._count.proposals > 0, count: tender._count.proposals },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        item.value ? "bg-emerald-500" : "bg-slate-200"
                      )}
                    />
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
