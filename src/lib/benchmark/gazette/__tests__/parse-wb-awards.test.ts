import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWbContractAwards } from "../parse-wb-awards";
import type { GazetteAdapterSource } from "../types";

const SOURCE: GazetteAdapterSource = {
  id: "s1",
  slug: "wb-eg",
  baseUrl: "https://search.worldbank.org/api/contractdata?format=json&countrycode=EG",
  country: "EG",
  defaultLanguage: "EN",
};

test("parseWbContractAwards maps a real WB contract row (winner, USD value, date, sector)", () => {
  const payload = {
    rows: 1,
    total: 3193,
    contract: [
      {
        contr_id: "1890406",
        contr_sgn_date: "23-Jun-2026",
        total_contr_amnt: "79344.00",
        procurement_group_desc: "Goods",
        suppinfo: [{ name: "CTS FOR CHEMICALS & TECHNICAL SERVICES", country: "EG" }],
        supp_name: ["CTS FOR CHEMICALS & TECHNICAL SERVICES"],
        mjsecname: ["Public Admin", "Transportation", "Water/Sanit/Waste"],
        sector: ["Other Public Adminis", "Urban Transport", "Waste Management"],
      },
    ],
  };
  const out = parseWbContractAwards(payload, SOURCE);
  assert.equal(out.length, 1);
  const a = out[0];
  assert.equal(a.externalId, "1890406");
  assert.equal(a.winnerName, "CTS FOR CHEMICALS & TECHNICAL SERVICES");
  assert.equal(a.awardedValue, 79344);
  assert.equal(a.currency, "USD");
  assert.equal(a.buyerName, null); // WB exposes the project, not the procuring agency
  assert.equal(a.bidderCount, null);
  assert.equal(a.country, "EG"); // stamped from the source, not the row
  assert.equal(a.sector, "infrastructure"); // Transportation / Water beats the modality
  assert.equal(a.awardedAt?.toISOString().slice(0, 10), "2026-06-23");
});

test("parseWbContractAwards classifies WB major sectors onto the app taxonomy", () => {
  const sectorOf = (mjsecname: string[], group: string) =>
    parseWbContractAwards(
      { contract: [{ contr_id: "1", total_contr_amnt: "100", supp_name: ["W"], mjsecname, procurement_group_desc: group }] },
      SOURCE
    )[0]?.sector;

  assert.equal(sectorOf(["Energy & Extractives"], "Goods"), "oil_gas");
  assert.equal(sectorOf(["Information & Communications Technologies"], "Goods"), "it");
  assert.equal(sectorOf(["Health"], "Goods"), "healthcare");
  assert.equal(sectorOf(["Transportation"], "Goods"), "infrastructure");
  // No project-sector match → fall back to procurement modality.
  assert.equal(sectorOf(["Education"], "Works"), "construction");
  assert.equal(sectorOf(["Public Administration"], "Consultant Services"), "consulting");
  assert.equal(sectorOf(["Financial Sector"], "Goods"), "other");
});

test("parseWbContractAwards falls back to supp_name and nulls a zero value", () => {
  const out = parseWbContractAwards(
    { contract: [{ contr_id: "2", total_contr_amnt: "0.00", supp_name: ["Fallback Winner"], mjsecname: [], sector: [] }] },
    SOURCE
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].winnerName, "Fallback Winner");
  assert.equal(out[0].awardedValue, null); // 0 → null
  assert.equal(out[0].currency, null);
  assert.equal(out[0].sector, "other");
});

test("parseWbContractAwards skips rows with no id or no signal; tolerates bare array + null country", () => {
  const skipped = parseWbContractAwards(
    {
      contract: [
        { total_contr_amnt: "100", supp_name: ["No ID"] }, // no contr_id → skip
        { contr_id: "3" }, // no winner, no value → skip
      ],
    },
    SOURCE
  );
  assert.equal(skipped.length, 0);

  const bare = parseWbContractAwards(
    [{ contr_id: "9", supp_name: ["Solo"], mjsecname: [], sector: [] }],
    { ...SOURCE, country: null }
  );
  assert.equal(bare.length, 1);
  assert.equal(bare[0].country, null);
  assert.equal(bare[0].awardedValue, null);
});
