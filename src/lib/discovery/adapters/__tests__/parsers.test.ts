import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRss, type AdapterSource } from "../rss";
import { parseOcds } from "../ocds";
import { parseWorldBank } from "../worldbank";

const SOURCE: AdapterSource = {
  id: "src1",
  slug: "test-source",
  baseUrl: "https://example.gov/feed",
  country: "SA",
  defaultLanguage: "EN",
};

test("RSS 2.0: maps items to normalized opportunities", () => {
  const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
    <item>
      <title>Construction of Riyadh School Complex</title>
      <link>https://example.gov/tenders/123</link>
      <description><![CDATA[Build of 12 classrooms &amp; a sports hall.]]></description>
      <guid>tender-123</guid>
      <pubDate>Wed, 10 Jun 2026 09:00:00 GMT</pubDate>
    </item>
    <item><title>x</title></item>  <!-- too short, skipped -->
  </channel></rss>`;
  const items = parseRss(xml, SOURCE);
  assert.equal(items.length, 1);
  assert.equal(items[0].titleEn, "Construction of Riyadh School Complex");
  assert.equal(items[0].sourceUrl, "https://example.gov/tenders/123");
  assert.equal(items[0].country, "SA");
  assert.ok(items[0].descriptionEn?.includes("classrooms & a sports hall"));
  assert.ok(items[0].publishedAt instanceof Date);
  assert.ok(items[0].externalId.length > 0);
});

test("Atom: falls back to <entry> with link href", () => {
  const xml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
    <entry>
      <title>Facilities Management Tender</title>
      <link href="https://example.gov/a/1" rel="alternate"/>
      <summary>FM services for municipal buildings.</summary>
      <id>urn:uuid:abc</id>
      <updated>2026-06-09T12:00:00Z</updated>
    </entry>
  </feed>`;
  const items = parseRss(xml, SOURCE);
  assert.equal(items.length, 1);
  assert.equal(items[0].titleEn, "Facilities Management Tender");
  assert.equal(items[0].sourceUrl, "https://example.gov/a/1");
});

test("RSS: malformed feed yields zero items, never throws", () => {
  assert.deepEqual(parseRss("<not valid xml", SOURCE), []);
  assert.deepEqual(parseRss("", SOURCE), []);
});

test("OCDS: release package maps tender fields", () => {
  const payload = {
    releases: [
      {
        ocid: "ocds-abc-0001",
        date: "2026-06-08T00:00:00Z",
        tender: {
          id: "T-0001",
          title: "EPC of Water Treatment Plant",
          description: "Design, procure, construct.",
          mainProcurementCategory: "works",
          procurementMethod: "open",
          value: { amount: 240000000, currency: "SAR" },
          tenderPeriod: { endDate: "2026-07-15T23:59:00Z" },
          documents: [{ url: "https://example.gov/docs/1.pdf" }],
        },
        buyer: { name: "National Water Company" },
      },
    ],
  };
  const items = parseOcds(payload, SOURCE);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.externalId, "ocds-abc-0001");
  assert.equal(it.titleEn, "EPC of Water Treatment Plant");
  assert.equal(it.buyerName, "National Water Company");
  assert.equal(it.estimatedValue, 240000000);
  assert.equal(it.currency, "SAR");
  assert.equal(it.sector, "works");
  assert.equal(it.sourceUrl, "https://example.gov/docs/1.pdf");
  assert.ok(it.closingDate instanceof Date);
});

test("OCDS: search-results envelope (results[].releases[]) is handled", () => {
  const payload = {
    results: [{ releases: [{ ocid: "x-1", tender: { title: "Road resurfacing programme" } }] }],
  };
  const items = parseOcds(payload, SOURCE);
  assert.equal(items.length, 1);
  assert.equal(items[0].titleEn, "Road resurfacing programme");
});

test("OCDS: bare array + missing fields are tolerated", () => {
  const payload = [
    { ocid: "y-1", tender: { title: "Valid one" } },
    { ocid: "y-2" }, // no tender → skipped
    { tender: { title: "no ocid" } }, // no ocid → skipped
  ];
  const items = parseOcds(payload, SOURCE);
  assert.equal(items.length, 1);
  assert.equal(items[0].externalId, "y-1");
});

test("World Bank: maps MENA civil-works notice, filters non-MENA + non-published", () => {
  const payload = {
    rows: 3,
    total: 3,
    procnotices: [
      {
        id: "OP00439235",
        notice_type: "Invitation for Bids",
        notice_status: "Published",
        noticedate: "12-Jun-2026",
        submission_deadline_date: "2026-07-16T00:00:00Z",
        project_ctry_name: "Egypt, Arab Republic of",
        project_id: "P178176",
        project_name: "Cairo Water Upgrade",
        bid_reference_no: "EG-WATER-544171-CW-RFB",
        bid_description: "Construction of a water treatment plant and pumping stations",
        procurement_group: "CW",
        procurement_method_name: "Request for Bids",
        contact_organization: "National Water Company",
        notice_text: "<p>Detailed <b>works</b> scope &amp; conditions.</p>",
      },
      {
        // Non-MENA → filtered out.
        id: "OP00400000",
        notice_status: "Published",
        project_ctry_name: "Congo, Democratic Republic of",
        bid_description: "Some other works",
        procurement_group: "CW",
      },
      {
        // Cancelled in MENA → filtered out (not Published).
        id: "OP00411111",
        notice_status: "Cancelled",
        project_ctry_name: "Saudi Arabia",
        bid_description: "A cancelled tender",
        procurement_group: "CW",
      },
    ],
  };
  const items = parseWorldBank(payload, SOURCE);
  assert.equal(items.length, 1);
  const it = items[0];
  assert.equal(it.externalId, "OP00439235");
  assert.equal(it.country, "EG");
  assert.equal(it.sector, "construction"); // CW → construction
  assert.equal(it.buyerName, "National Water Company");
  assert.equal(it.referenceNo, "EG-WATER-544171-CW-RFB");
  assert.ok(it.descriptionEn?.includes("works scope & conditions")); // HTML stripped + entities decoded
  assert.ok(it.closingDate instanceof Date);
  assert.ok(it.publishedAt instanceof Date); // "12-Jun-2026" parsed
  assert.ok(it.sourceUrl?.includes("P178176"));
});
