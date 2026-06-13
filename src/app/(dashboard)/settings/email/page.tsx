import { redirect } from "next/navigation";
import Link from "next/link";
import type { EmailStatus } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext, hasRole } from "@/lib/auth";
import { getEmailActivity } from "@/lib/data/email";
import { isEmailConfigured } from "@/lib/email/resend";

export const metadata = { title: "Email activity" };

const STATUSES: EmailStatus[] = [
  "QUEUED",
  "SENDING",
  "SENT",
  "DELIVERED",
  "FAILED",
  "BOUNCED",
  "COMPLAINED",
  "CANCELLED",
];

const STATUS_CLASS: Record<string, string> = {
  SENT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  DELIVERED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  QUEUED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SENDING: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  BOUNCED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  COMPLAINED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  CANCELLED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default async function EmailActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; days?: string; page?: string }>;
}) {
  const { org, member } = await getAuthContext();
  if (!hasRole(member.role, "ADMIN")) redirect("/settings/workspace");

  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as EmailStatus) ? (sp.status as EmailStatus) : null;
  const days = sp.days ? Number(sp.days) : 30;
  const page = sp.page ? Math.max(1, Number(sp.page)) : 1;

  const data = await getEmailActivity(org.id, { status, days, page });
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  const sent = (data.statusCounts.SENT ?? 0) + (data.statusCounts.DELIVERED ?? 0);
  const failed = (data.statusCounts.FAILED ?? 0) + (data.statusCounts.BOUNCED ?? 0);
  const queued = (data.statusCounts.QUEUED ?? 0) + (data.statusCounts.SENDING ?? 0);

  return (
    <>
      <PageHeader
        title="Email activity"
        description="Delivery status of every email sent from your workspace."
      />

      <div className="mx-auto max-w-4xl space-y-5 p-6">
        {!isEmailConfigured() && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            Email sending isn&apos;t configured yet (no Resend API key). Events are recorded but no
            mail is delivered until it&apos;s set up.
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sent" value={sent} tone="text-emerald-600" />
          <Stat label="Queued / sending" value={queued} tone="text-blue-600" />
          <Stat label="Failed / bounced" value={failed} tone="text-red-600" />
        </div>

        {/* Filters */}
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="text-xs text-slate-500">
            Status
            <select
              name="status"
              defaultValue={status ?? ""}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Window
            <select
              name="days"
              defaultValue={String(days)}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </form>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-2.5 font-medium">Recipient</th>
                <th className="px-4 py-2.5 font-medium">Subject</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    No emails in this window.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.toEmail}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 dark:text-slate-100">{r.subject}</div>
                      <div className="text-xs text-slate-400">{r.event}</div>
                      {r.error && <div className="mt-1 text-xs text-red-500">{r.error}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CLASS[r.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {(r.sentAt ?? r.createdAt).toISOString().replace("T", " ").slice(0, 16)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Page {data.page} of {totalPages} · {data.total} emails
            </span>
            <div className="flex gap-2">
              {data.page > 1 && (
                <PageLink status={status} days={days} page={data.page - 1} label="Previous" />
              )}
              {data.page < totalPages && (
                <PageLink status={status} days={days} page={data.page + 1} label="Next" />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PageLink({
  status,
  days,
  page,
  label,
}: {
  status: string | null;
  days: number;
  page: number;
  label: string;
}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("days", String(days));
  params.set("page", String(page));
  return (
    <Link
      href={`/settings/email?${params.toString()}`}
      className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {label}
    </Link>
  );
}
