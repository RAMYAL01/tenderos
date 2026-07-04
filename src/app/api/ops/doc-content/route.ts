import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { downloadFromS3, getProcessedContentKey } from "@/lib/s3";

/**
 * Read-only diagnostic: for a tender's documents, probe the processed-content
 * download that the requirement-extraction agent hangs on — IN-REGION, where R2
 * works reliably. Reports size + timing so we can tell "download hangs / content
 * is huge" apart from "the after() background function is being reaped".
 * Secured by CRON_SECRET. PURE READ.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms))]);
}

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenderId = new URL(req.url).searchParams.get("tenderId");
  if (!tenderId) return NextResponse.json({ error: "tenderId query param required" }, { status: 400 });

  const docs = await db.document.findMany({
    where: { tenderId, deletedAt: null },
    select: { id: true, originalFilename: true, pageCount: true, fileSizeBytes: true, processingStatus: true, extractionMethod: true },
  });

  const results = [];
  for (const doc of docs) {
    const key = getProcessedContentKey(doc.id);
    const t0 = Date.now();
    let probe: Record<string, unknown>;
    try {
      const buf = await withTimeout(downloadFromS3(key), 25_000);
      let fullTextChars: number | null = null;
      let pages: number | null = null;
      try {
        const parsed = JSON.parse(buf.toString("utf-8"));
        fullTextChars = typeof parsed.fullText === "string" ? parsed.fullText.length : null;
        pages = Array.isArray(parsed.pages) ? parsed.pages.length : null;
      } catch {
        /* not JSON / truncated */
      }
      probe = { ok: true, downloadMs: Date.now() - t0, contentBytes: buf.length, fullTextChars, pages };
    } catch (e) {
      probe = { ok: false, ms: Date.now() - t0, error: e instanceof Error ? e.message : String(e) };
    }
    results.push({
      docId: doc.id,
      filename: doc.originalFilename,
      pageCount: doc.pageCount,
      fileSizeBytes: String(doc.fileSizeBytes),
      processingStatus: doc.processingStatus,
      extractionMethod: doc.extractionMethod,
      processedContent: probe,
    });
  }

  return NextResponse.json({ tenderId, documents: results });
}
