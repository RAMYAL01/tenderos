import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { embedText, cosineSimilarity } from "@/lib/ai/embeddings";
import { anthropic, MODELS } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({ question: z.string().min(2).max(1000) });

interface Source {
  id: string;
  title: string;
  type: string;
  score: number;
}

/**
 * POST /api/knowledge/ask
 *
 * Corporate Knowledge Brain — Retrieval-Augmented Generation.
 * 1. Embed the question
 * 2. Cosine-similarity search over the org's knowledge embeddings
 * 3. Claude answers using ONLY the retrieved company documents (with citations)
 */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid question" }, { status: 400 });
  }
  const { question } = parsed.data;

  const org = await db.organization.findUnique({ where: { clerkOrgId: orgId } });
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load knowledge items with embeddings
  const items = await db.contentLibraryItem.findMany({
    where: { orgId: org.id, deletedAt: null, embeddingEn: { not: undefined } },
    select: { id: true, titleEn: true, contentEn: true, tags: true, embeddingEn: true },
    take: 500,
  });

  const withEmbeddings = items.filter((i) => Array.isArray(i.embeddingEn) && i.contentEn);

  if (withEmbeddings.length === 0) {
    return NextResponse.json({
      answer:
        "Your Knowledge Brain is empty. Add company documents — case studies, certifications, CVs, past performance — and I'll be able to answer questions about them.",
      sources: [],
    });
  }

  // Retrieve top matches
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(question);
  } catch (e) {
    console.error("[ask] embedding failed:", e);
    return NextResponse.json({ error: "Embedding service unavailable" }, { status: 503 });
  }

  const ranked = withEmbeddings
    .map((item) => ({
      item,
      score: cosineSimilarity(queryEmbedding, item.embeddingEn as number[]),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((r) => r.score > 0.15);

  if (ranked.length === 0) {
    return NextResponse.json({
      answer:
        "I couldn't find anything relevant to that question in your company knowledge base. Try rephrasing, or add the relevant documents.",
      sources: [],
    });
  }

  const context = ranked
    .map(
      (r, i) =>
        `[Document ${i + 1}] ${r.item.titleEn}\n${(r.item.contentEn ?? "").slice(0, 3000)}`
    )
    .join("\n\n---\n\n");

  const system = `You are the Corporate Knowledge Assistant for "${org.name}". Answer the user's question using ONLY the company documents provided below.

Rules:
- Base every statement strictly on the provided documents. Do NOT use outside knowledge or invent facts.
- If the documents don't contain the answer, say clearly: "I don't have that information in the knowledge base."
- Be concise and specific. When you state a fact, reference the document it came from (e.g. "according to Document 2").
- If the question asks to list things (projects, certifications), list them with the key details found.

COMPANY DOCUMENTS:
${context}`;

  let answer = "";
  try {
    const res = await anthropic.messages.create({
      model: MODELS.CLAUDE_SONNET,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: question }],
    });
    answer = res.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("\n");
  } catch (e) {
    console.error("[ask] claude failed:", e);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const sources: Source[] = ranked.map((r) => ({
    id: r.item.id,
    title: r.item.titleEn,
    type: r.item.tags[0] ?? "other",
    score: Math.round(r.score * 100) / 100,
  }));

  return NextResponse.json({ answer, sources });
}
