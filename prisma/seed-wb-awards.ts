/**
 * Seed the World Bank Major Contract Awards gazette sources (Wave 1, item 4/d) and
 * run one ingestion pass to populate the benchmark pool immediately.
 *
 *   SEED_ENV_FILE=/path/to/prod.env npx tsx prisma/seed-wb-awards.ts
 *   (or just DATABASE_URL in the environment)
 *
 * One GazetteSource per WB-borrower MENA country (the WB API filters by borrower
 * country). Idempotent: sources upsert on slug, awards upsert on externalKey, so
 * re-running (and the daily cron) refreshes rather than duplicates. Gulf states are
 * absent by design — they don't borrow from the WB (needs a licensed feed).
 */
import { readFileSync } from "node:fs";

// Load DATABASE_URL/DIRECT_URL from a dotenv file BEFORE any module constructs a
// PrismaClient. Minimal parser (no shell expansion). Static imports of @/lib/prisma
// would be hoisted and run first, so prisma is pulled in via dynamic import below.
const envFile = process.env.SEED_ENV_FILE;
if (envFile) {
  for (const line of readFileSync(envFile, "utf-8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const WB = "https://search.worldbank.org/api/contractdata?format=json&rows=150&countrycode=";

// Verified to return award data on 2026-07-02 (YE/PS/LY returned 0 under these codes).
const COUNTRIES: { cc: string; name: string }[] = [
  { cc: "EG", name: "Egypt" },
  { cc: "MA", name: "Morocco" },
  { cc: "JO", name: "Jordan" },
  { cc: "TN", name: "Tunisia" },
  { cc: "IQ", name: "Iraq" },
  { cc: "LB", name: "Lebanon" },
  { cc: "DJ", name: "Djibouti" },
  { cc: "DZ", name: "Algeria" },
  { cc: "MR", name: "Mauritania" },
  { cc: "SD", name: "Sudan" },
];

async function main() {
  const { db } = await import("@/lib/prisma");
  try {
    for (const { cc, name } of COUNTRIES) {
      const slug = `wb-awards-${cc.toLowerCase()}`;
      await db.gazetteSource.upsert({
        where: { slug },
        create: { slug, adapterKey: "wb-contract-awards", baseUrl: `${WB}${cc}`, country: cc, name: `World Bank awards — ${name}`, isActive: true },
        update: { adapterKey: "wb-contract-awards", baseUrl: `${WB}${cc}`, country: cc, name: `World Bank awards — ${name}`, isActive: true },
      });
      console.log(`✓ source ${slug} (${cc})`);
    }

    // Ingestion (fetch → parse → entity-resolve → upsert) is heavily latency-bound
    // and belongs in-region (Vercel ↔ Neon). From a laptop it is slow and the pooled
    // connection tends to reset, so it is OFF by default here: hit the in-region
    // endpoint GET /api/ops/ingest-gazette (Bearer CRON_SECRET) or wait for the daily
    // cron. Set RUN_INGESTION=1 to attempt it from here anyway.
    if (process.env.RUN_INGESTION === "1") {
      const { runGazetteIngestion } = await import("@/lib/benchmark/ingest-gazette");
      console.log("Running gazette ingestion…");
      const summary = await runGazetteIngestion();
      console.log("Ingestion summary:", JSON.stringify(summary));
    } else {
      console.log("Sources seeded. Run ingestion in-region via GET /api/ops/ingest-gazette (Bearer CRON_SECRET) or the daily cron.");
    }

    const [total, gazette, byCountry, competitors] = await Promise.all([
      db.awardOutcome.count(),
      db.awardOutcome.count({ where: { sourceType: "GAZETTE" } }),
      db.awardOutcome.groupBy({ by: ["country"], _count: { _all: true }, where: { sourceType: "GAZETTE" } }),
      db.competitor.count(),
    ]);
    console.log(`AwardOutcome total=${total} gazette=${gazette} competitors=${competitors}`);
    console.log("by country:", byCountry.map((g) => `${g.country ?? "—"}:${g._count._all}`).join("  "));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
