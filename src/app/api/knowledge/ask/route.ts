import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { db } from "@/lib/prisma";
import { embedQuery } from "@/lib/ai/embedding-provider";
import { tenantChunkSearch } from "@/lib/security/rag-search";
import { getChatModel } from "@/lib/ai/llm-provider";

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z.object({ question: z.string().min(2).max(1000) });

interface Source {
  id: string;
  title: string;
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

  // 1. Embed the question with the configured provider.
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(question);
  } catch (e) {
    console.error("[ask] embedding failed:", e);
    return NextResponse.json({ error: "Embedding service unavailable" }, { status: 503 });
  }

  // 2. Tenant-bound vector search — pre-filtered by orgId in SQL, pre-rank.
  //    No cross-tenant chunk can ever be a candidate here.
  const hits = await tenantChunkSearch(org.id, queryEmbedding, {
    limit: 8,
    minSimilarity: 0.2,
  });

  if (hits.length === 0) {
    return NextResponse.json({
      answer:
        "I couldn't find anything relevant in your company knowledge base. Add documents — case studies, certifications, CVs, past performance — or rephrase the question.",
      sources: [],
    });
  }

  // 3. Build the grounding context from the retrieved chunks only.
  const context = hits
    .map((h, i) => `[Excerpt ${i + 1} — ${h.title}]\n${h.content}`)
    .join("\n\n---\n\n");

  const system = `You are the Corporate Knowledge Assistant for "${org.name}". Answer the user's question using ONLY the company excerpts provided below.

Rules:
- Base every statement strictly on the provided documents. Do NOT use outside knowledge or invent facts.
- If the excerpts don't contain the answer, say clearly: "I don't have that information in the knowledge base."
- Be concise and specific. When you state a fact, reference the excerpt it came from (e.g. "according to Excerpt 2").
- If the question asks to list things (projects, certifications), list them with the key details found.

COMPANY EXCERPTS:
${context}`;

  let answer = "";
  try {
    // Provider-agnostic — Claude (cloud) or local vLLM via LLM_PROVIDER.
    const res = await generateText({
      model: getChatModel(),
      maxOutputTokens: 1024,
      system,
      prompt: question,
    });
    answer = res.text;
  } catch (e) {
    console.error("[ask] generation failed:", e);
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  // Sources: one entry per source document, scored by its best matching chunk.
  const bySource = new Map<string, Source>();
  for (const h of hits) {
    const prev = bySource.get(h.sourceId);
    const score = Math.round(h.similarity * 100) / 100;
    if (!prev || score > prev.score) {
      bySource.set(h.sourceId, { id: h.sourceId, title: h.title, score });
    }
  }
  const sources: Source[] = [...bySource.values()].sort((a, b) => b.score - a.score);

  return NextResponse.json({ answer, sources });
}
