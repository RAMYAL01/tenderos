import { fetchJson } from "@/lib/discovery/adapters/http";
import type { GazetteAdapterSource, NormalizedAward } from "../types";
import { parseWbContractAwards } from "../parse-wb-awards";

/**
 * World Bank Major Contract Awards adapter. Configure one GazetteSource per country
 * with adapterKey="wb-contract-awards", country=<ISO2>, and baseUrl pointing at the
 * WB contract API filtered to that borrower country + JSON, e.g.:
 *
 *   https://search.worldbank.org/api/contractdata?format=json&rows=150&countrycode=EG
 *
 * The API returns newest-first, so a bounded `rows` gives the most recent awards.
 * Reuses the hardened, bounded fetch from the discovery stack (15s / 8 MB caps).
 */
export async function fetchWbContractAwards(source: GazetteAdapterSource): Promise<NormalizedAward[]> {
  if (!source.baseUrl) throw new Error(`WB-awards source ${source.slug} has no baseUrl`);
  return parseWbContractAwards(await fetchJson(source.baseUrl), source);
}
