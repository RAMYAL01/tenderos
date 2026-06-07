/**
 * Proposal Section Drafting Agent
 *
 * Generates proposal section content using Claude 3.5 Sonnet.
 * Supports streaming (SSE) for real-time display in the editor.
 * Uses RAG from the content library for context.
 */

import { streamText } from "ai";
import { db } from "@/lib/prisma";
import { getChatModel, activeModelId } from "@/lib/ai/llm-provider";
import {
  getDraftSectionSystemPrompt,
  getExecutiveSummarySystemPrompt,
  type ToneType,
} from "@/lib/ai/prompts/draft-section";
import { getContentLibraryContext } from "@/lib/ai/embeddings";
import type { ContentLanguage, SectionType } from "@prisma/client";

interface DraftSectionOptions {
  sectionId: string;
  sectionType: SectionType;
  tenderId: string;
  orgId: string;
  language: ContentLanguage;
  tone: ToneType;
  additionalContext?: string;
}

/**
 * Stream a proposal section draft via Claude.
 * Returns an Anthropic stream that can be piped to an SSE response.
 */
export async function streamSectionDraft(
  opts: DraftSectionOptions
): Promise<ReadableStream<Uint8Array>> {
  // ── Load context ───────────────────────────────────────────────────────────

  const [tender, section, sectionRequirements] = await Promise.all([
    db.tender.findUnique({
      where: { id: opts.tenderId },
      select: {
        titleEn: true,
        titleAr: true,
        clientName: true,
        tenderType: true,
        primaryLanguage: true,
      },
    }),
    db.proposalSection.findUnique({
      where: { id: opts.sectionId },
      select: {
        sectionType: true,
        titleEn: true,
        contentEn: true, // Existing content (for revision context)
      },
    }),
    // Requirements relevant to this section
    db.complianceMatrixRow.findMany({
      where: {
        tenderId: opts.tenderId,
        sectionReference: opts.sectionType,
      },
      include: {
        requirement: {
          select: { textEn: true, textAr: true, priority: true },
        },
      },
      take: 20,
    }),
  ]);

  if (!tender) throw new Error("Tender not found");

  // ── Build requirement context ──────────────────────────────────────────────
  const relevantRequirements = sectionRequirements
    .map((row) =>
      `[${row.requirement.priority}] ${row.requirement.textEn}` +
      (row.requirement.textAr ? ` (AR: ${row.requirement.textAr})` : "")
    )
    .filter(Boolean);

  // If no section-specific requirements, get all requirements
  let allRequirements: string[] = [];
  if (relevantRequirements.length === 0) {
    const allReqs = await db.requirement.findMany({
      where: { tenderId: opts.tenderId, deletedAt: null },
      select: { textEn: true, priority: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 30,
    });
    allRequirements = allReqs.map((r) => `[${r.priority}] ${r.textEn}`);
  }

  // ── Get content library context (RAG) ─────────────────────────────────────
  let libraryContext: string[] = [];
  try {
    const sectionLabel = opts.sectionType.replace(/_/g, " ").toLowerCase();
    const query = `${sectionLabel} ${tender.tenderType ?? ""} ${tender.clientName ?? ""}`;
    libraryContext = await getContentLibraryContext(
      opts.orgId,
      query,
      opts.sectionType,
      3
    );
  } catch {
    // Library context is optional — proceed without it
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  const systemPrompt = getDraftSectionSystemPrompt({
    sectionType: opts.sectionType,
    language: opts.language,
    tone: opts.tone,
    tenderTitle: tender.titleEn + (tender.titleAr ? ` / ${tender.titleAr}` : ""),
    clientName: tender.clientName ?? undefined,
    tenderType: tender.tenderType ?? undefined,
    relevantRequirements:
      relevantRequirements.length > 0
        ? relevantRequirements
        : allRequirements,
    libraryContext: libraryContext.length > 0 ? libraryContext : undefined,
    additionalContext: opts.additionalContext,
  });

  // Include existing content for revision context
  const userMessage =
    section?.contentEn && section.contentEn.length > 50
      ? `Please improve and expand the following existing draft of the ${opts.sectionType.replace(/_/g, " ").toLowerCase()} section:\n\n${section.contentEn}`
      : `Write the ${opts.sectionType.replace(/_/g, " ").toLowerCase()} section now.`;

  // ── Stream from Claude ─────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Provider-agnostic streaming — Claude (cloud) or local vLLM.
        const result = streamText({
          model: getChatModel(),
          maxOutputTokens: 3000,
          system: systemPrompt,
          prompt: userMessage,
        });

        // Stream text deltas as SSE events
        for await (const delta of result.textStream) {
          const data = JSON.stringify({ text: delta });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        // Track usage for cost accounting
        const usage = await result.usage;
        const usageData = JSON.stringify({ done: true, model: activeModelId(), usage });
        controller.enqueue(encoder.encode(`data: ${usageData}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const errorData = JSON.stringify({
          error: err instanceof Error ? err.message : "Stream failed",
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

/**
 * Non-streaming section draft (for async jobs).
 * Returns the full generated text.
 */
export async function generateSectionDraft(
  opts: DraftSectionOptions
): Promise<string> {
  // Reuse the same prompt building logic
  const stream = await streamSectionDraft(opts);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n\n");
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") break;
      try {
        const parsed = JSON.parse(data);
        if (parsed.text) fullText += parsed.text;
      } catch {}
    }
  }

  return fullText;
}
