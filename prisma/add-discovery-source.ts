/**
 * Register a REAL Discovery source so the daily cron starts ingesting live
 * tenders from it. Idempotent (upsert on slug). Run with env vars:
 *
 *   SOURCE_SLUG=uk-contracts-finder \
 *   SOURCE_NAME="UK Contracts Finder" \
 *   SOURCE_ADAPTER=ocds \
 *   SOURCE_URL="https://www.contractsfinder.service.gov.uk/Published/Notices/OCDS/Search?stages=tender" \
 *   SOURCE_COUNTRY=GB \
 *   npx tsx prisma/add-discovery-source.ts
 *
 * adapterKey ∈ { rss, ocds, gcc-seed }. For GCC government portals that require
 * credentials or have no public feed, point SOURCE_URL at an authorized API or
 * a scraping-service output that emits RSS/OCDS.
 */
import { upsertSource } from "../src/lib/discovery/ingest";

const slug = process.env.SOURCE_SLUG;
const name = process.env.SOURCE_NAME;
const adapterKey = process.env.SOURCE_ADAPTER;
const baseUrl = process.env.SOURCE_URL ?? null;
const country = process.env.SOURCE_COUNTRY ?? null;

if (!slug || !name || !adapterKey) {
  console.error("Set SOURCE_SLUG, SOURCE_NAME, SOURCE_ADAPTER (rss|ocds|gcc-seed), and (for rss/ocds) SOURCE_URL.");
  process.exit(1);
}
if (!["rss", "ocds", "gcc-seed"].includes(adapterKey)) {
  console.error(`Unknown adapter "${adapterKey}". Use one of: rss, ocds, gcc-seed.`);
  process.exit(1);
}
if (adapterKey !== "gcc-seed" && !baseUrl) {
  console.error(`adapter "${adapterKey}" needs SOURCE_URL (the feed/endpoint).`);
  process.exit(1);
}

upsertSource({
  slug,
  name,
  kind: adapterKey === "rss" ? "RSS" : adapterKey === "ocds" ? "API" : "GOVERNMENT_PORTAL",
  adapterKey,
  baseUrl,
  country,
})
  .then((s) => {
    console.log(`[discovery] registered source ${slug} (${s.id}) — adapter=${adapterKey}, url=${baseUrl ?? "n/a"}`);
    console.log("The daily refresh cron will ingest it on the next run (or trigger /api/cron/refresh-opportunities).");
    process.exit(0);
  })
  .catch((e) => {
    console.error("[discovery] failed:", e);
    process.exit(1);
  });
