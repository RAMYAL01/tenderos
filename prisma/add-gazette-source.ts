/**
 * Add (or update) a GazetteSource — a public award-notice feed that flows into the
 * benchmark pool (sourceType=GAZETTE). Adding an award source is a DATA operation.
 *
 *   npx tsx prisma/add-gazette-source.ts <slug> <adapterKey> <baseUrl> [countryISO2] [name]
 *
 * Example (an OCDS endpoint that serves award releases):
 *   npx tsx prisma/add-gazette-source.ts ksa-ocds-awards ocds-awards \
 *     "https://example-portal/api/ocds/releases?stage=award" SA "KSA portal (awards)"
 *
 * Example (World Bank Major Contract Awards, one borrower country):
 *   npx tsx prisma/add-gazette-source.ts eg-wb-awards wb-contract-awards \
 *     "https://search.worldbank.org/api/contractdata?format=json&rows=150&countrycode=EG" EG "World Bank awards — Egypt"
 *
 * Adapter keys: see src/lib/benchmark/gazette/index.ts (currently: ocds-awards, wb-contract-awards).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const [slug, adapterKey, baseUrl, country, name] = process.argv.slice(2);
  if (!slug || !adapterKey || !baseUrl) {
    console.error("Usage: tsx prisma/add-gazette-source.ts <slug> <adapterKey> <baseUrl> [countryISO2] [name]");
    process.exit(1);
  }
  const src = await db.gazetteSource.upsert({
    where: { slug },
    create: { slug, adapterKey, baseUrl, country: country || null, name: name || slug, isActive: true },
    update: { adapterKey, baseUrl, country: country || null, name: name || slug, isActive: true },
  });
  console.log(`✓ GazetteSource "${src.slug}" → ${src.adapterKey} (${src.country ?? "—"})  [${src.isActive ? "active" : "inactive"}]`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
