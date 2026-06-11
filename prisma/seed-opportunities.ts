/**
 * Seed the global Discovery catalog with a representative GCC government tender
 * source + opportunities. Idempotent (upsert on natural keys) — safe to re-run.
 *
 *   npx tsx prisma/seed-opportunities.ts
 *
 * NOTE: writes the global catalog via the ONLY sanctioned path (ingest.ts).
 */
import { upsertSource, ingestOpportunities } from "../src/lib/discovery/ingest";
import { fetchGccSeedOpportunities } from "../src/lib/discovery/adapters/gcc-seed";

async function main() {
  const source = await upsertSource({
    slug: "gcc-gov-seed",
    name: "GCC Government Tenders (Seed)",
    kind: "GOVERNMENT_PORTAL",
    adapterKey: "gcc-seed",
    country: null,
    baseUrl: "https://example.gov",
    defaultLanguage: "BILINGUAL",
  });

  const items = fetchGccSeedOpportunities();
  const res = await ingestOpportunities(source.id, items);
  console.log(`[seed] source=${source.id} inserted=${res.inserted} updated=${res.updated} unchanged=${res.unchanged}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exit(1);
  });
