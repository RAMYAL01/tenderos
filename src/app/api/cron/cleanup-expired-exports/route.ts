import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { deleteFromS3 } from "@/lib/s3";
import { logger } from "@/lib/logger";

/**
 * Cron: Clean up expired export files
 * Schedule: Daily at 2am UTC (vercel.json)
 *
 * Deletes export job records and their S3 files where:
 * - downloadExpiresAt has passed (>24h ago)
 * - Status is COMPLETED (already downloaded)
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Verify this is a legitimate Vercel cron request
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const expiredExports = await db.exportJob.findMany({
    where: {
      status: "COMPLETED",
      downloadExpiresAt: { lt: cutoff },
      outputStorageKey: { not: null },
    },
    select: { id: true, outputStorageKey: true },
    take: 100, // Process in batches
  });

  let deletedCount = 0;
  let errorCount = 0;

  for (const job of expiredExports) {
    try {
      if (job.outputStorageKey) {
        await deleteFromS3(job.outputStorageKey);
      }
      await db.exportJob.update({
        where: { id: job.id },
        data: {
          outputStorageKey: null,
          outputFilename: null,
          status: "EXPIRED" as any,
        },
      });
      deletedCount++;
    } catch (err) {
      errorCount++;
      logger.error({ err, jobId: job.id }, "Failed to delete expired export");
    }
  }

  logger.info(
    { deletedCount, errorCount, total: expiredExports.length },
    "Cleaned up expired exports"
  );

  return NextResponse.json({
    success: true,
    processed: expiredExports.length,
    deleted: deletedCount,
    errors: errorCount,
  });
}
