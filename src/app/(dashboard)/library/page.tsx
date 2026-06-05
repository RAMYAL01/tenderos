import { PageHeader } from "@/components/ui/page-header";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { AskPanel } from "@/components/knowledge/ask-panel";
import { AddKnowledgeDialog } from "@/components/knowledge/add-knowledge-dialog";
import { KnowledgeList } from "@/components/knowledge/knowledge-list";

export const metadata = { title: "Knowledge Brain" };

export default async function LibraryPage() {
  const { org } = await getAuthContext();

  const items = await db.contentLibraryItem.findMany({
    where: { orgId: org.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      titleEn: true,
      contentEn: true,
      tags: true,
      embeddingEn: true,
    },
    take: 200,
  });

  const list = items.map((i) => ({
    id: i.id,
    title: i.titleEn,
    type: i.tags[0] ?? "other",
    snippet: (i.contentEn ?? "").replace(/\s+/g, " ").slice(0, 160),
    embedded: Array.isArray(i.embeddingEn) && (i.embeddingEn as unknown[]).length > 0,
  }));

  return (
    <>
      <PageHeader
        title="Knowledge Brain"
        titleAr="ذاكرة الشركة"
        description="Your company's knowledge — ask questions, get answers grounded in your own documents."
      >
        <AddKnowledgeDialog />
      </PageHeader>

      <div className="space-y-6 p-6">
        <AskPanel hasKnowledge={list.length > 0} />

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Knowledge Base
              <span className="ml-2 text-xs font-normal text-slate-400">
                {list.length} document{list.length === 1 ? "" : "s"}
              </span>
            </h3>
          </div>
          <KnowledgeList items={list} />
        </div>
      </div>
    </>
  );
}
