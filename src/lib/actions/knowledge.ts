"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { getAuthContext, requireRole } from "@/lib/auth";
import { embedText } from "@/lib/ai/embeddings";

export interface ActionResult {
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

/** Knowledge categories — stored as the first tag for filtering. */
export const KNOWLEDGE_TYPES = [
  "case_study",
  "past_performance",
  "cv",
  "company_profile",
  "certification",
  "iso_document",
  "sop",
  "technical_report",
  "other",
] as const;

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

    // Embed the title + content for semantic retrieval.
    let embedding: number[] | null = null;
    try {
      embedding = await embedText(`${title}\n\n${content}`);
    } catch (e) {
      console.error("[knowledge] embedding failed:", e);
      // Still store the item — it just won't be semantically searchable.
    }

    const item = await db.contentLibraryItem.create({
      data: {
        orgId: org.id,
        titleEn: title,
        contentEn: content,
        tags: [knowledgeType, ...(tags ?? [])],
        contentSource: "IMPORTED",
        createdById: member.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        embeddingEn: embedding as any,
      },
    });

    revalidatePath("/library");
    return { success: true, id: item.id };
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
