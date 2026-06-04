import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { cn, formatDeadline } from "@/lib/utils";
import type { RecentTender } from "@/lib/data/dashboard";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  ACTIVE: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  SUBMITTED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  WON: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  LOST: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
  NO_DECISION: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  CANCELLED: "bg-slate-100 text-slate-400",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

interface RecentTendersProps {
  tenders: RecentTender[];
}

export function RecentTenders({ tenders }: RecentTendersProps) {
  if (tenders.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Recent Tenders
          </h3>
        </div>

        {/* Empty state */}
        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 dark:border-slate-700 dark:bg-slate-900/50">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <FileText className="h-7 w-7 text-slate-400" />
          </div>
          <h4 className="mb-1 font-medium text-slate-700 dark:text-slate-300">
            No tenders yet
          </h4>
          <p className="mb-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Create your first tender to start preparing <br />
            a compliant technical proposal.
          </p>
          <Button asChild size="sm">
            <Link href="/tenders/new">
              <Plus className="mr-2 h-4 w-4" />
              New Tender
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          Recent Tenders
        </h3>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" asChild>
          <Link href="/tenders">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Tender
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="hidden whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 lg:table-cell">
                Deadline
              </th>
              <th className="hidden whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell">
                Docs
              </th>
              <th className="hidden whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-500 xl:table-cell">
                Created by
              </th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {tenders.map((tender) => (
              <tr
                key={tender.id}
                className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                {/* Title */}
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tenders/${tender.id}`}
                      className="line-clamp-1 font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {tender.titleEn}
                    </Link>
                    {tender.clientName && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {tender.clientName}
                        {tender.referenceNo && (
                          <span className="ml-1.5 text-slate-400">
                            · {tender.referenceNo}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge status={tender.status} />
                </td>

                {/* Deadline */}
                <td className="hidden px-4 py-3 lg:table-cell">
                  {tender.submissionDeadline ? (
                    <span
                      className={cn(
                        "text-xs",
                        new Date(tender.submissionDeadline) < new Date()
                          ? "text-red-500"
                          : "text-slate-500"
                      )}
                    >
                      {formatDeadline(tender.submissionDeadline)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>

                {/* Documents */}
                <td className="hidden px-4 py-3 xl:table-cell">
                  <span className="text-xs text-slate-500">
                    {tender._count.documents} docs ·{" "}
                    {tender._count.requirements} reqs
                  </span>
                </td>

                {/* Creator */}
                <td className="hidden px-4 py-3 xl:table-cell">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={tender.createdBy.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {tender.createdBy.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs text-slate-500">
                      {tender.createdBy.name}
                    </span>
                  </div>
                </td>

                {/* Arrow */}
                <td className="px-4 py-3">
                  <Link href={`/tenders/${tender.id}`}>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
