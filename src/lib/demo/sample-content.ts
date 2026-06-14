/**
 * THE sample-tender content — one source of truth, no DB, no server-only.
 * Consumed by BOTH the in-app seed (sample-tender.ts, writes it to a real org)
 * and the PUBLIC /demo page (renders it read-only, no login). Keep it pure data.
 */

export const SAMPLE_TENDER = {
  titleEn: "Riyadh Regional Hospital Expansion Project",
  referenceNo: "MOH-2026-001",
  clientName: "Ministry of Health (Saudi Arabia)",
  clientCountry: "SA",
  sector: "construction",
  tenderType: "RFP",
  deadlineDays: 28, // days from now
  estimatedValue: "450000000",
  currency: "SAR",
} as const;

export const SAMPLE_DOCUMENT = {
  filename: "Riyadh_Hospital_Expansion_RFP.pdf",
  pageCount: 128,
  sizeBytes: 4_210_000,
} as const;

export type SampleRequirement = {
  textEn: string;
  type: "MANDATORY" | "OPTIONAL";
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  sectionRef: string;
  pageRef: number;
  status: "COMPLETED" | "IN_PROGRESS" | "NOT_STARTED" | "FLAGGED";
  responseEn?: string;
};

export const SAMPLE_REQUIREMENTS: SampleRequirement[] = [
  { textEn: "Bidder must hold a valid Saudi Contractors Authority classification — Grade 1 (Buildings).", type: "MANDATORY", priority: "CRITICAL", sectionRef: "3.1", pageRef: 12, status: "COMPLETED", responseEn: "Grade 1 (Buildings) classification, certificate no. SCA-1184. Attached as Annex A." },
  { textEn: "Minimum 10 years' experience delivering healthcare facilities of ≥150 beds.", type: "MANDATORY", priority: "HIGH", sectionRef: "3.2", pageRef: 13, status: "COMPLETED", responseEn: "14 years; 3 reference hospital projects (320, 200, 180 beds) in Annex B." },
  { textEn: "ISO 9001:2015, ISO 14001:2015 and ISO 45001:2018 certifications required.", type: "MANDATORY", priority: "HIGH", sectionRef: "3.4", pageRef: 15, status: "COMPLETED", responseEn: "All three current; certificates in Annex C." },
  { textEn: "HSE plan compliant with the Saudi Building Code (SBC) and MOH facility standards.", type: "MANDATORY", priority: "HIGH", sectionRef: "5.2", pageRef: 41, status: "IN_PROGRESS" },
  { textEn: "Construction period not to exceed 30 months from site handover.", type: "MANDATORY", priority: "CRITICAL", sectionRef: "2.3", pageRef: 8, status: "IN_PROGRESS" },
  { textEn: "Minimum 30% local content under the Saudi In-Country Value (ICV) program.", type: "MANDATORY", priority: "HIGH", sectionRef: "6.1", pageRef: 52, status: "FLAGGED" },
  { textEn: "Bid bond of 2% of the tender value, valid for 120 days.", type: "MANDATORY", priority: "CRITICAL", sectionRef: "1.5", pageRef: 4, status: "NOT_STARTED" },
  { textEn: "BIM Level 2 deliverables for design coordination.", type: "OPTIONAL", priority: "MEDIUM", sectionRef: "4.3", pageRef: 33, status: "NOT_STARTED" },
  { textEn: "Prior experience with modular MEP installation in operational hospitals.", type: "OPTIONAL", priority: "MEDIUM", sectionRef: "3.5", pageRef: 17, status: "COMPLETED", responseEn: "Modular MEP delivered at King Fahd Medical Wing (2023). Case study in Annex D." },
];

export const SAMPLE_BID = {
  score: 0.74,
  baseScore: 0.71,
  llmAdjustment: 0.03,
  confidence: 0.42,
  recommendation: "BID" as const,
  factors: {
    profileFit: 0.82,
    geographyFit: 0.9,
    valueFit: 0.68,
    historyFit: 0.55,
    deadlinePressure: 0.5,
    requirementsRisk: 0.65,
  },
  rationale:
    "Strong fit: healthcare-construction track record and Grade 1 classification align well with the mandatory requirements, and the Riyadh location is a core market. The 30-month programme and the 2% bid bond are the main commitments to manage. Recommend bidding, subject to confirming ICV sourcing to reach the 30% local-content floor.",
  risks: [
    { title: "Local-content (ICV) shortfall", severity: "high" as const, detail: "Reaching the 30% In-Country Value floor needs early supplier commitments." },
    { title: "Tight 30-month programme", severity: "medium" as const, detail: "Phased works on a live hospital campus compress the schedule; off-site fabrication is assumed." },
    { title: "Bid bond cash", severity: "low" as const, detail: "2% of SAR 450M for 120 days ties up working capital." },
  ],
  questions: [
    "Will MOH consider a phased handover to de-risk the 30-month programme?",
    "Is the 30% ICV measured at contract award or over the project lifecycle?",
    "Are theatre/ICU HVAC standards SBC or a stricter MOH facility spec?",
  ],
} as const;

export const FACTOR_LABELS: Record<string, string> = {
  profileFit: "Capability fit",
  geographyFit: "Geography",
  valueFit: "Value fit",
  historyFit: "Track record",
  deadlinePressure: "Timeline",
  requirementsRisk: "Requirements risk",
};

export type SampleSection = {
  type: "EXECUTIVE_SUMMARY" | "TECHNICAL_APPROACH" | "COMPANY_OVERVIEW";
  titleEn: string;
  contentEn: string;
};

export const SAMPLE_SECTIONS: SampleSection[] = [
  {
    type: "EXECUTIVE_SUMMARY",
    titleEn: "Executive Summary",
    contentEn:
      "We are pleased to submit our proposal for the Riyadh Regional Hospital Expansion — a 300-bed acute-care expansion delivered to MOH and Saudi Building Code standards within the 30-month programme.\n\nOur approach combines a proven healthcare-construction track record (14 years, 3 reference hospitals), an integrated BIM-coordinated MEP strategy, and a 32% In-Country Value commitment that exceeds the tender minimum. A dedicated HSE regime and a phased handover plan protect the live clinical campus throughout construction.",
  },
  {
    type: "TECHNICAL_APPROACH",
    titleEn: "Technical Approach & Methodology",
    contentEn:
      "Phasing. Works are sequenced in four phases to keep the existing hospital fully operational, with isolated construction zones, dedicated logistics routes, and infection-control hoarding to MOH standards.\n\nStructure & envelope. Post-tensioned RC frame with a unitised façade; off-site fabrication of bathroom pods and MEP modules compresses the critical path by ~6 weeks.\n\nMEP & medical systems. Fully BIM Level 2 coordinated; medical gas, HVAC (HEPA for theatres/ICU), and BMS integrated with the existing campus. Commissioning follows a witnessed, MOH-compliant protocol.",
  },
  {
    type: "COMPANY_OVERVIEW",
    titleEn: "Company Overview & Past Performance",
    contentEn:
      "A Grade 1 (Buildings) contractor with 14 years delivering complex healthcare and institutional projects across the Kingdom. Recent references: 320-bed Specialist Hospital (Riyadh, 2024), 200-bed Maternity & Children's Hospital (Dammam, 2022), and a 180-bed General Hospital (Qassim, 2021) — all delivered on or ahead of programme with zero lost-time incidents in the last 1.2M man-hours.",
  },
];
