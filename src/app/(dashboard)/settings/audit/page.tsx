import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getAuditPage } from "@/lib/data/audit";
import { cn } from "@/lib/utils";

export const metadata = { title: "Audit Log" };

const ACTION_LABELS: Record<string, string> = {
  "member.role_changed": "Role changed",
  "member.removed": "Member removed",
  "invitation.created": "Invitation sent",
  "invitation.revoked": "Invitation revoked",
  "tender.outcome_recorded": "Outcome recorded",
  "tender.bid_decision": "Bid decision",
  "proposal.submitted": "Proposal submitted",
  "proposal.approved": "Proposal approved",
  "proposal.changes_requested": "Changes requested",
  "proposal.reopened": "Proposal reopened",
};

function summarize(row: { newValues: unknown; oldValues: unknown }): string {
  const nv = (row.newValues ?? {}) as Record<string, unknown>;
  const ov = (row.oldValues ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (ov.role && nv.role) parts.push(`${ov.role} → ${nv.role}`);
  else if (nv.role) parts.push(String(nv.role));
  if (nv.email) parts.push(String(nv.email));
  if (ov.email && !nv.email) parts.push(String(ov.email));
  if (nv.status) parts.push(String(nv.status));
  if (nv.decision) parts.push(`decision: ${nv.decision}`);
  if (nv.lossReason) parts.push(`reason: ${nv.lossReason}`);
  if (nv.note) parts.push(`“${String(nv.note).slice(0, 60)}”`);
  return parts.join(" · ");
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; days?: string; page?: string }>;
}) {
  const { org, member } = await getAuthContext();
  if (!hasRole(member.role, "ADMIN")) redirect("/settings/workspace");

  const sp = await searchParams;
  const action = sp.action || undefined;
  const days = sp.days ? Math.max(1, Math.min(365, parseInt(sp.days, 10) || 90)) : 90;
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1;

  const data = await getAuditPage({ orgId: org.id, action, days, page });

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { action, days: String(days), page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "page" && v === "1")) params.set(k, String(v));
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <ScrollText className="h-5 w-5 text-blue-600" /> Audit Log
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Security-significant workspace activity: roles, invitations, approvals,
            decisions, and outcomes. Append-only — entries are never edited or deleted.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/audit/export?days=${days}${action ? `&action=${encodeURIComponent(action)}` : ""}`}>
            <Download className="h-4 w-4" /> Export CSV
          </a>
        </Button>
      </div>

      {/* Filters (plain GET form — server-rendered) */}
      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <select
          name="action"
          defaultValue={action ?? ""}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">All events</option>
          {data.actions.map((a) => (
            <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
          ))}
        </select>
        <select
          name="days"
          defaultValue={String(days)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
        <Button type="submit" size="sm" variant="secondary">Apply</Button>
        <span className="ml-auto text-xs text-slate-400">{data.total} entries</span>
      </form>

      {/* Table */}
      {data.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-20 text-center dark:border-slate-800">
          <p className="text-sm text-slate-500">
            No audit entries in this window yet. Security-significant actions
            (role changes, invitations, approvals, outcomes) appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Actor</th>
                <th className="px-4 py-2.5">Event</th>
                <th className="px-4 py-2.5">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => (
                <tr
                  key={r.id}
                  className={cn(
                    "align-top",
                    i > 0 && "border-t border-slate-100 dark:border-slate-800"
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-slate-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                    {r.actorName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {ACTION_LABELS[r.action] ?? r.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{summarize(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || data.hasMore) && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={qs({ page: page - 1 })}><ChevronLeft className="h-4 w-4" /> Newer</Link>
            </Button>
          ) : <span />}
          {data.hasMore && (
            <Button variant="outline" size="sm" asChild>
              <Link href={qs({ page: page + 1 })}>Older <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
