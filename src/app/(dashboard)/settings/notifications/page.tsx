import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Configure deadline reminders, review requests, and team alerts"
      />
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Email and in-app notification preferences will be configurable in{" "}
            <strong>Phase 2</strong>. Currently, email notifications are sent for:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {[
              "Team member invitations",
              "Deadline reminders (7 days, 3 days, 1 day before submission)",
              "Proposal review requests and approvals",
              "Document processing completion",
              "AI job completions",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
