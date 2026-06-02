import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Shield, Clock, Monitor } from "lucide-react";
import { format } from "date-fns";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const { org, member } = await getAuthContext();

  const recentAuditLogs = await db.auditLog.findMany({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      member: { select: { name: true, email: true, avatarUrl: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Security"
        description="Audit logs, active sessions, and security settings"
      />

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Security status */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-900/10">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-800 dark:text-emerald-400">
                Your workspace is secured
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-500">
                Authentication managed by Clerk · All data encrypted at rest (AES-256) · TLS 1.3 in transit
              </p>
            </div>
          </div>
        </div>

        {/* Your session */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-slate-400" />
            <h3 className="font-medium text-slate-900 dark:text-slate-100">
              Current Session
            </h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Signed in as <strong>{member.email}</strong>
            {member.lastLoginAt && (
              <> · Last login: {format(new Date(member.lastLoginAt), "d MMM yyyy, HH:mm")}</>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Active sessions are managed in your{" "}
            <a
              href="https://accounts.clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Clerk account settings →
            </a>
          </p>
        </div>

        {/* Audit log */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="font-medium text-slate-900 dark:text-slate-100">
              Audit Log
            </h3>
            <span className="ml-auto text-xs text-slate-400">
              Last 20 events
            </span>
          </div>

          {recentAuditLogs.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No audit events yet.</p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-5 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                        {log.action}
                      </span>
                      {log.resourceType && (
                        <span className="text-xs text-slate-400">
                          · {log.resourceType}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {log.member?.name ?? "System"} ·{" "}
                      {log.ipAddress && `${log.ipAddress} · `}
                      {format(new Date(log.createdAt), "d MMM, HH:mm:ss")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
