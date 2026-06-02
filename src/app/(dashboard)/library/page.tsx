import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Content Library" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Content Library"
        titleAr="مكتبة المحتوى"
        description="Reusable proposal blocks, past performance, CVs, and templates."
      />
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-sm text-slate-500">Content Library — implemented in Step 5.</p>
      </div>
    </>
  );
}
