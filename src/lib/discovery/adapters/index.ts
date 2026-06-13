import type { NormalizedOpportunity } from "@/lib/discovery/ingest";
import { fetchGccSeedOpportunities } from "./gcc-seed";
import { fetchRssOpportunities, type AdapterSource } from "./rss";
import { fetchOcdsOpportunities } from "./ocds";
import { fetchWorldBankOpportunities } from "./worldbank";

/**
 * Adapter registry — resolves OpportunitySource.adapterKey to its fetcher.
 *
 * Adding a real source is now a DATA operation, not a code change: insert an
 * OpportunitySource row with one of these adapterKeys and the feed URL in
 * baseUrl. The cron picks it up on the next run.
 *
 *   adapterKey="worldbank" baseUrl=<WB procnotices JSON endpoint> (REAL, MENA)
 *   adapterKey="rss"       baseUrl=<RSS/Atom feed of tender notices>
 *   adapterKey="ocds"      baseUrl=<OCDS releases/search endpoint>
 *   adapterKey="gcc-seed"  (the built-in demo catalog — no network)
 */
export type { AdapterSource };

export type Adapter = (source: AdapterSource) => Promise<NormalizedOpportunity[]>;

export const ADAPTERS: Record<string, Adapter> = {
  "gcc-seed": async () => fetchGccSeedOpportunities(),
  rss: fetchRssOpportunities,
  ocds: fetchOcdsOpportunities,
  worldbank: fetchWorldBankOpportunities,
};
