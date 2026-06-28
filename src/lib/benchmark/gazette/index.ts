import type { GazetteAdapter } from "./types";
import { fetchOcdsAwards } from "./adapters/ocds-awards";

/**
 * Gazette adapter registry — resolves GazetteSource.adapterKey to its fetcher.
 * Adding an award source is a DATA operation: insert a GazetteSource row with one
 * of these adapterKeys + the feed URL (prisma/add-gazette-source.ts). The cron
 * picks it up on the next run.
 *
 *   adapterKey="ocds-awards"  baseUrl=<OCDS releases endpoint carrying award releases>
 *
 * National MENA portals (Etimad, Monaqasat, …) publish award gazettes mostly as
 * Arabic HTML/PDF behind anti-bot/auth — not a server-fetchable feed. Wire them
 * via a licensed OCDS / aggregator endpoint (same adapterKey) when available.
 */
export const GAZETTE_ADAPTERS: Record<string, GazetteAdapter> = {
  "ocds-awards": fetchOcdsAwards,
};
