import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Win rates, proposal performance, team activity, and AI usage."
      />
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-sm text-slate-500">Analytics dashboard — implemented in Step 6.</p>
      </div>
    </>
  );
}
