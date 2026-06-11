import type { NormalizedOpportunity } from "@/lib/discovery/ingest";

/**
 * Seed adapter — a hand-curated set of representative GCC government
 * infrastructure tenders. Stands in for a real portal ingestion adapter
 * (Etimad/Etihad/etc.) in Sprint 1 so the end-to-end loop is demoable.
 *
 * Real adapters (Sprint 2+) implement the same NormalizedOpportunity[] contract
 * keyed by OpportunitySource.adapterKey.
 */

const DAY = 86_400_000;
const future = (days: number) => new Date(Date.now() + days * DAY);
const past = (days: number) => new Date(Date.now() - days * DAY);

export function fetchGccSeedOpportunities(): NormalizedOpportunity[] {
  const items: Omit<NormalizedOpportunity, "raw">[] = [
    {
      externalId: "SA-MOMRAH-2026-0412",
      titleEn: "Construction of Riyadh Northern Ring Road Interchange (Package 3)",
      titleAr: "إنشاء تقاطع الطريق الدائري الشمالي بالرياض (الحزمة 3)",
      descriptionEn: "Design-build of a grade-separated interchange including bridges, earthworks, drainage and asphalt paving.",
      buyerName: "Ministry of Municipal and Rural Affairs and Housing",
      buyerNameAr: "وزارة الشؤون البلدية والقروية والإسكان",
      country: "SA", sector: "infrastructure", tenderType: "RFP",
      referenceNo: "MOMRAH/INF/2026/0412",
      estimatedValue: 240_000_000, currency: "SAR",
      publishedAt: past(3), closingDate: future(22), language: "BILINGUAL",
      sourceUrl: "https://example.gov.sa/tenders/0412",
    },
    {
      externalId: "AE-DM-2026-1187",
      titleEn: "Facilities Management Services — Dubai Municipality Buildings (3-Year)",
      titleAr: "خدمات إدارة المرافق لمباني بلدية دبي (3 سنوات)",
      descriptionEn: "Integrated hard and soft FM: HVAC, MEP maintenance, cleaning, landscaping and 24/7 helpdesk.",
      buyerName: "Dubai Municipality", buyerNameAr: "بلدية دبي",
      country: "AE", sector: "facilities", tenderType: "ITT",
      referenceNo: "DM/FM/2026/1187",
      estimatedValue: 65_000_000, currency: "AED",
      publishedAt: past(6), closingDate: future(5), language: "BILINGUAL",
      sourceUrl: "https://example.gov.ae/tenders/1187",
    },
    {
      externalId: "SA-NWC-2026-0099",
      titleEn: "EPC of Jeddah Wastewater Treatment Plant Expansion (Phase II)",
      titleAr: "هندسة وتوريد وإنشاء توسعة محطة معالجة مياه الصرف بجدة (المرحلة الثانية)",
      descriptionEn: "EPC delivery of a 250,000 m³/day wastewater treatment capacity expansion.",
      buyerName: "National Water Company", buyerNameAr: "شركة المياه الوطنية",
      country: "SA", sector: "water", tenderType: "RFP",
      referenceNo: "NWC/EPC/2026/0099",
      estimatedValue: 480_000_000, currency: "SAR",
      publishedAt: past(10), closingDate: future(34), language: "BILINGUAL",
      sourceUrl: "https://example.gov.sa/tenders/0099",
    },
    {
      externalId: "QA-ASHGHAL-2026-0560",
      titleEn: "Doha Metro Phase 3 — Stations Civil & Architectural Works",
      buyerName: "Public Works Authority (Ashghal)",
      country: "QA", sector: "construction", tenderType: "ITB",
      referenceNo: "PWA/2026/0560",
      estimatedValue: 1_100_000_000, currency: "QAR",
      publishedAt: past(2), closingDate: future(40), language: "EN",
      sourceUrl: "https://example.gov.qa/tenders/0560",
    },
    {
      externalId: "SA-ARAMCO-2026-7781",
      titleEn: "EPC — Gas Compression Facility, Eastern Province",
      buyerName: "Saudi Aramco",
      country: "SA", sector: "oil_gas", tenderType: "RFP",
      referenceNo: "ARAMCO/PROJ/2026/7781",
      estimatedValue: 920_000_000, currency: "USD",
      publishedAt: past(8), closingDate: future(28), language: "EN",
      sourceUrl: "https://example.aramco.com/tenders/7781",
    },
    {
      externalId: "AE-MUSANADA-2026-0321",
      titleEn: "Abu Dhabi Schools Construction Programme — 6 New Schools",
      titleAr: "برنامج إنشاء مدارس أبوظبي — 6 مدارس جديدة",
      buyerName: "Abu Dhabi General Services (Musanada)",
      country: "AE", sector: "construction", tenderType: "RFP",
      referenceNo: "MUS/EDU/2026/0321",
      estimatedValue: 310_000_000, currency: "AED",
      publishedAt: past(5), closingDate: future(18), language: "BILINGUAL",
      sourceUrl: "https://example.gov.ae/tenders/0321",
    },
    {
      externalId: "KW-CTC-2026-0044",
      titleEn: "Engineering Consultancy — Kuwait Coastal Road Rehabilitation",
      buyerName: "Central Tenders Committee, Kuwait",
      country: "KW", sector: "infrastructure", tenderType: "EOI",
      referenceNo: "CTC/2026/0044",
      estimatedValue: 18_000_000, currency: "KWD",
      publishedAt: past(1), closingDate: future(12), language: "EN",
      sourceUrl: "https://example.gov.kw/tenders/0044",
    },
    {
      externalId: "OM-TENDER-2026-0210",
      titleEn: "Design Consultancy — Muscat Sewerage Network Extension",
      buyerName: "Tender Board, Oman",
      country: "OM", sector: "water", tenderType: "RFQ",
      referenceNo: "TB/2026/0210",
      estimatedValue: 9_500_000, currency: "OMR",
      publishedAt: past(14), closingDate: future(3), language: "EN",
      sourceUrl: "https://example.gov.om/tenders/0210",
    },
    {
      externalId: "EG-GAFI-2026-0777",
      titleEn: "Construction of New Administrative Capital — Utilities Package",
      titleAr: "إنشاء العاصمة الإدارية الجديدة — حزمة المرافق",
      buyerName: "General Authority for Investment (GAFI)",
      country: "EG", sector: "infrastructure", tenderType: "ITB",
      referenceNo: "GAFI/2026/0777",
      estimatedValue: 150_000_000, currency: "USD",
      publishedAt: past(4), closingDate: future(26), language: "BILINGUAL",
      sourceUrl: "https://example.gov.eg/tenders/0777",
    },
    {
      externalId: "SA-MOH-2026-0333",
      titleEn: "Hospital Facilities Management — Riyadh Cluster (Closed Example)",
      buyerName: "Ministry of Health",
      country: "SA", sector: "facilities", tenderType: "ITT",
      referenceNo: "MOH/FM/2026/0333",
      estimatedValue: 88_000_000, currency: "SAR",
      publishedAt: past(40), closingDate: past(2), language: "BILINGUAL", // CLOSED — exercises status derivation
      sourceUrl: "https://example.gov.sa/tenders/0333",
    },
  ];

  return items.map((i) => ({ ...i, raw: i }));
}
