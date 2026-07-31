import { notFound } from "next/navigation";
import { getPlatformAdmin } from "@/lib/auth/platform-admin";
import { db } from "@/lib/prisma";
import { formatMoney } from "@/lib/billing/invoices";
import { CreateInvoiceForm } from "@/components/admin/create-invoice-form";
import { InvoiceAdminActions } from "@/components/admin/invoice-admin-actions";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Billing operations" };
export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  OVERDUE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  VOID: "bg-slate-100 text-slate-400 line-through dark:bg-slate-800 dark:text-slate-500",
};

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminBillingPage() {
  // Operator-only. Non-operators (and unconfigured allowlist) get a 404 — the
  // console never leaks its existence to a regular signed-in user.
  const operator = await getPlatformAdmin();
  if (!operator) notFound();

  const [orgs, invoices] = await Promise.all([
    db.organization.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        planTier: true,
        createdAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { organization: { select: { name: true } } },
    }),
  ]);

  const orgOptions = orgs.map((o) => ({ id: o.id, name: o.name, planTier: o.planTier }));

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Billing operations</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manual invoicing console · signed in as {operator.email}
        </p>
      </div>

      {/* Create invoice */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Issue an invoice
        </h2>
        <CreateInvoiceForm orgs={orgOptions} />
      </section>

      {/* Invoices */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 p-4 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
          Invoices ({invoices.length})
        </h2>
        {invoices.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No invoices yet. Issue one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                  <th className="p-3 font-medium">Number</th>
                  <th className="p-3 font-medium">Organization</th>
                  <th className="p-3 font-medium">Plan</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium">Due</th>
                  <th className="p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/50">
                    <td className="p-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {inv.number}
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{inv.organization.name}</td>
                    <td className="p-3 text-slate-500">
                      {inv.planTier} · {inv.billingCycle}
                    </td>
                    <td className="p-3 tabular-nums text-slate-700 dark:text-slate-300">
                      {formatMoney(inv.amountDue, inv.currency)}
                    </td>
                    <td className="p-3">
                      <Badge className={`border-0 ${STATUS_STYLES[inv.status] ?? ""}`}>
                        {inv.status}
                      </Badge>
                      {inv.paymentReportedAt && inv.status !== "PAID" && (
                        <span className="ml-2 text-[11px] text-emerald-600">payment reported</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500">{fmtDate(inv.dueAt)}</td>
                    <td className="p-3">
                      <InvoiceAdminActions
                        invoiceId={inv.id}
                        status={inv.status}
                        paymentReference={inv.paymentReference}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Orgs overview */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="border-b border-slate-100 p-4 text-sm font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
          Workspaces ({orgs.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <th className="p-3 font-medium">Organization</th>
                <th className="p-3 font-medium">Plan</th>
                <th className="p-3 font-medium">Subscription</th>
                <th className="p-3 font-medium">Renews</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 dark:border-slate-800/50">
                  <td className="p-3 text-slate-700 dark:text-slate-300">{o.name}</td>
                  <td className="p-3 text-slate-500">{o.planTier}</td>
                  <td className="p-3 text-slate-500">{o.subscription?.status ?? "—"}</td>
                  <td className="p-3 text-slate-500">{fmtDate(o.subscription?.currentPeriodEnd ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
