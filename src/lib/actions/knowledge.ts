"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { ingestKnowledgeDocument } from "@/lib/knowledge/ingest";
import { KNOWLEDGE_TYPES } from "@/lib/knowledge-types";

interface ActionResult {
  success: boolean;
  id?: string;
  error?: string;
}

function isRedirect(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

const AddSchema = z.object({
  title: z.string().min(2, "Title required").max(300),
  content: z.string().min(10, "Content is too short").max(50000),
  knowledgeType: z.enum(KNOWLEDGE_TYPES),
  tags: z.array(z.string()).max(20).optional(),
});

/**
 * Add a knowledge item to the Corporate Knowledge Brain.
 * Embeds the text (OpenAI) so it's retrievable by the Ask interface.
 */
export async function addKnowledgeItem(
  data: z.infer<typeof AddSchema>
): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const parsed = AddSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { title, content, knowledgeType, tags } = parsed.data;

    // Chunk + embed + persist (source document and per-chunk pgvectors) inside a
    // single tenant-bound transaction. Embeddings populate the secure pgvector
    // path queried by tenantChunkSearch — strictly isolated to this org.
    const result = await ingestKnowledgeDocument({
      orgId: org.id,
      memberId: member.id,
      title,
      content,
      tags: [knowledgeType, ...(tags ?? [])],
    });

    revalidatePath("/library");
    return { success: true, id: result.sourceId };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("addKnowledgeItem error:", err);
    return { success: false, error: "Failed to add knowledge item." };
  }
}

export async function deleteKnowledgeItem(id: string): Promise<ActionResult> {
  try {
    const { org, member } = await getAuthContext();
    requireRole(member.role, "WRITER");

    const item = await db.contentLibraryItem.findFirst({
      where: { id, orgId: org.id },
      select: { id: true },
    });
    if (!item) return { success: false, error: "Not found." };

    await db.contentLibraryItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/library");
    return { success: true };
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("deleteKnowledgeItem error:", err);
    return { success: false, error: "Failed to delete." };
  }
}
