import { PrismaClient } from "@prisma/client";

/**
 * PrismaClient singleton — prevents creating multiple connections in
 * Next.js development (hot-reload creates new module instances).
 * In production, each serverless invocation gets one client.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
