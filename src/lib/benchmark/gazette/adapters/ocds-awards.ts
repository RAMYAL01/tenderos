import { fetchJson } from "@/lib/discovery/adapters/http";
import type { GazetteAdapterSource, NormalizedAward } from "../types";
import { parseOcdsAwards } from "../parse-ocds-awards";

/**
 * OCDS award adapter — fetches an OCDS releases/search endpoint and extracts the
 * award notices. Configure a GazetteSource with adapterKey="ocds-awards" and the
 * feed URL in baseUrl. Reuses the hardened, bounded fetch from the discovery stack.
 */
export async function fetchOcdsAwards(source: GazetteAdapterSource): Promise<NormalizedAward[]> {
  if (!source.baseUrl) throw new Error(`OCDS-awards source ${source.slug} has no baseUrl`);
  return parseOcdsAwards(await fetchJson(source.baseUrl), source);
}
