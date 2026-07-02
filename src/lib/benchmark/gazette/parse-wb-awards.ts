import type { GazetteAdapterSource, NormalizedAward } from "./types";

/**
 * World Bank "Major Contract Awards" parser (Wave 1, item 4 — real MENA feed).
 *
 * The WB publishes every prior-reviewed, Bank-financed contract award as public
 * JSON (search.worldbank.org/api/contractdata). Unlike OCDS this is NOT a standard
 * envelope, so it gets its own parser. It is the first REAL, server-fetchable award
 * feed with genuine MENA coverage (Egypt, Morocco, Jordan, Tunisia, Iraq, Lebanon,
 * Djibouti, Algeria, Mauritania, Sudan — WB-financed projects). Amounts are USD.
 *
 * Coverage caveat: WB borrowers only — the GCC (KSA/UAE/QA/KW/OM/BH) does not
 * borrow from the WB, so this feed carries no Gulf awards (needs a licensed feed).
 *
 * Envelope: { rows, total, contract: [ {contr_id, total_contr_amnt, suppinfo:[{name}],
 *   mjsecname:[], sector:[], procurement_group_desc, contr_sgn_date, ...} ] }
 * Pure + network-free (unit-tested). The borrower country is stamped from the
 * source (each WB source is one country via ?countrycode=XX), not read from the row.
 */

const MAX_ITEMS = 500;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const numOf = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v.replace(/,/g, "")); return Number.isFinite(n) ? n : null; }
  return null;
};

const WB_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
/** WB dates are "DD-Mon-YYYY" (e.g. "23-Jun-2026"); parse that explicitly, then fall back to Date.parse. */
function parseWbDate(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const m = /^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/.exec(s);
  if (m) {
    const mo = WB_MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo != null) return new Date(Date.UTC(Number(m[3]), mo, Number(m[1])));
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Map WB project major-sector + procurement modality onto the app's SECTORS taxonomy. */
function classifyWbSector(major: string[], finer: string[], group: string | null): string {
  const kw = [...major, ...finer].join(" ").toLowerCase();
  const has = (...tokens: string[]) => tokens.some((t) => kw.includes(t));

  // Project sector wins over contract modality (a MENA contractor filters by sector).
  if (has("energy", "extractive", "oil", "gas", "mining", "petroleum")) return "oil_gas";
  if (has("information", "communication", "ict", "telecom", "digital")) return "it";
  if (has("health")) return "healthcare";
  if (has("transport", "water", "sanitation", "sanit", "waste", "irrigation", "urban", "road", "rail", "port", "airport", "bridge", "highway")) return "infrastructure";

  // No clear project sector → fall back to procurement modality.
  const g = (group ?? "").toLowerCase();
  if (g.includes("works")) return "construction";
  if (g.includes("consultant")) return "consulting";
  return "other";
}

function firstSupplierName(contract: Json): string | null {
  for (const s of arr(contract.suppinfo)) {
    const name = str(obj(s)?.name);
    if (name) return name;
  }
  for (const n of arr(contract.supp_name)) {
    const name = str(n);
    if (name) return name;
  }
  return null;
}

const strArr = (v: unknown): string[] => arr(v).map((x) => str(x) ?? "").filter(Boolean);

export function parseWbContractAwards(payload: unknown, source: GazetteAdapterSource): NormalizedAward[] {
  const root = obj(payload);
  const contracts = root && Array.isArray(root.contract) ? root.contract : Array.isArray(payload) ? payload : [];
  const out: NormalizedAward[] = [];

  for (const cRaw of contracts) {
    try {
      const c = obj(cRaw);
      if (!c) continue;
      const id = str(c.contr_id);
      if (!id) continue;

      const winnerName = firstSupplierName(c);
      const awardedValue = numOf(c.total_contr_amnt);
      if (!winnerName && awardedValue == null) continue; // no useful signal

      out.push({
        externalId: id.slice(0, 250),
        buyerName: null, // WB exposes the project, not the procuring agency — don't fabricate a buyer.
        winnerName,
        awardedValue: awardedValue != null && awardedValue > 0 ? awardedValue : null,
        currency: awardedValue != null && awardedValue > 0 ? "USD" : null,
        sector: classifyWbSector(strArr(c.mjsecname), strArr(c.sector), str(c.procurement_group_desc)),
        country: source.country ?? null,
        awardedAt: parseWbDate(c.contr_sgn_date),
        bidderCount: null, // not published by the WB awards feed
        sourceUrl: source.baseUrl,
      });
      if (out.length >= MAX_ITEMS) break;
    } catch {
      // Skip a malformed contract; never fail the whole batch.
    }
  }
  return out;
}
