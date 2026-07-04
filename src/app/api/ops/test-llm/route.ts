import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getChatModel } from "@/lib/ai/llm-provider";
import { MODELS } from "@/lib/ai/client";

/**
 * Read-only LLM connectivity probe. Makes a TINY generateObject call against each
 * model and reports success/latency/error — to tell "the API/key is broken" apart
 * from "the big 60k-char extraction chunks are just too slow for the timeout".
 * Secured by CRON_SECRET.
 */
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const Schema = z.object({ answer: z.string() });

async function probe(label: string, model: Parameters<typeof generateObject>[0]["model"]) {
  const t0 = Date.now();
  try {
    const r = await generateObject({
      model,
      schema: Schema,
      prompt: "Return JSON with an 'answer' field set to the word ok.",
      maxOutputTokens: 50,
      temperature: 0,
      abortSignal: AbortSignal.timeout(40_000),
    });
    return { label, ok: true, ms: Date.now() - t0, answer: r.object.answer, tokens: (r.usage.inputTokens ?? 0) + (r.usage.outputTokens ?? 0) };
  } catch (e) {
    return { label, ok: false, ms: Date.now() - t0, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const haiku = await probe("haiku", getChatModel(MODELS.CLAUDE_HAIKU));
  const dflt = await probe("default", getChatModel());

  return NextResponse.json({
    env: {
      LLM_PROVIDER: process.env.LLM_PROVIDER ?? "(unset → cloud/Anthropic)",
      LLM_MODEL: process.env.LLM_MODEL ?? "(unset)",
      hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      anthropicKeyPrefix: process.env.ANTHROPIC_API_KEY?.slice(0, 7) ?? null,
    },
    haiku,
    default: dflt,
  });
}
