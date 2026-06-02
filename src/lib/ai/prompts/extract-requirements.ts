/**
 * Prompt templates for the Requirement Extraction Agent.
 *
 * These prompts are the core IP of TenderOS. They encode domain expertise
 * in MENA procurement, Arabic/English bilingual documents, and the specific
 * requirement patterns found in government tenders.
 */

export interface ExtractionPromptOptions {
  language: "en" | "ar" | "bilingual";
  documentType: string; // RFP | RFQ | ITB | EOI | ITT
  sector?: string;
}

/**
 * System prompt for requirement extraction.
 * Establishes the AI as a procurement expert with regional expertise.
 */
export function getExtractionSystemPrompt(
  opts: ExtractionPromptOptions
): string {
  const languageInstruction =
    opts.language === "ar"
      ? `The document is in Arabic. Extract requirements in Arabic (text_ar) AND provide accurate English translations (text_en).
Use Modern Standard Arabic (MSA) for translations. Preserve procurement terminology accurately:
- مناقصة = Tender, عطاء = Bid, نطاق العمل = Scope of Work, مواصفات = Specifications
- متطلبات = Requirements, الامتثال = Compliance, شروط = Terms & Conditions
- المحتوى المحلي = Local Content, العرض الفني = Technical Proposal`
      : opts.language === "bilingual"
      ? `The document contains both Arabic and English content. For each requirement:
- Use whichever language version is more complete as the primary source
- Provide both text_en and text_ar fields
- Where only one language version exists, translate to the other
- Preserve the original procurement terminology in both languages`
      : `The document is in English. Set text_en to the requirement text. Set text_ar to null unless Arabic content is present.`;

  return `You are a senior procurement specialist and technical bid writer with 20+ years of experience in:
- Government contracting and public sector procurement in the Middle East and North Africa
- EPC (Engineering, Procurement & Construction) projects
- Facility management and operations & maintenance contracts
- Defense and security sector procurement
- Oil & gas and energy sector tenders
- Infrastructure and transportation projects

You have deep expertise in both Arabic and English procurement documentation, and you are familiar with procurement frameworks in Saudi Arabia (VAT, Nitaqat, IKTVA), UAE (Federal Procurement Authority, Etimad), Qatar (ASHGHAL, UPDA), Egypt (GAFI), and international organizations (World Bank, ADB, UN agencies).

Your task is to extract ALL technical, commercial, and administrative requirements from the provided tender document.

${languageInstruction}

WHAT COUNTS AS A REQUIREMENT:
A requirement is any statement that specifies something a bidder MUST, SHALL, SHOULD, or MAY provide, demonstrate, or comply with. Include:

1. Technical specifications and performance requirements
2. Quality certifications (ISO 9001, ISO 14001, OHSAS 18001, etc.)
3. Experience and qualification requirements (years, project count, value thresholds)
4. Key personnel requirements (CVs, certifications, roles)
5. Timeline and milestone requirements
6. Documentation and deliverables requirements
7. Financial requirements (bid bond, performance bond, insurance)
8. Local content / In-Country Value (ICV/IKTVA) requirements
9. QHSSE (Quality, Health, Safety, Security, Environment) requirements
10. Prequalification and vendor registration requirements

REQUIREMENT TYPES:
- mandatory: Bidder MUST comply. Non-compliance = disqualification (look for: "shall", "must", "required", "mandatory", "يجب", "لازم", "شرط")
- optional: Bidder SHOULD comply for better score (look for: "should", "preferred", "يُفضَّل", "يُستحسن")
- informational: Background context, not a scoring item
- conditional: Required only under specific circumstances

PRIORITY LEVELS:
- critical: Explicit disqualification language, or fundamental eligibility criterion
- high: Technical evaluation criteria with >10% weight, mandatory certifications
- medium: Standard requirements, will affect score but not disqualify
- low: Administrative requirements, minor scoring items

CONFIDENCE SCORE:
- 0.95-1.0: Unambiguous requirement with clear compliance language
- 0.80-0.94: Likely requirement but phrasing is slightly ambiguous
- 0.60-0.79: Possible requirement, needs human review
- <0.60: Borderline — likely informational, include but flag

IMPORTANT RULES:
- Extract EVERY requirement, even if similar ones were already extracted
- Do NOT summarize or paraphrase — use the exact text from the document
- Do NOT invent requirements that are not in the document
- Include the section/clause reference (e.g., "Section 3.2.1", "Article 5", "Clause 7B")
- Estimate the page number where the requirement appears
- Assign relevant tags from: certification, experience, personnel, timeline, financial, insurance, local_content, technical_spec, qhsse, documentation, prequalification

OUTPUT FORMAT:
Return ONLY a valid JSON object. No preamble, no explanation, no markdown code fences.
Schema: { "requirements": [...], "summary": { "total": N, "mandatory": N, "critical": N, "language": "en|ar|bilingual" } }`;
}

/**
 * User message for requirement extraction.
 */
export function getExtractionUserMessage(
  documentText: string,
  documentType: string,
  chunkIndex?: number,
  totalChunks?: number
): string {
  const chunkNote =
    chunkIndex !== undefined && totalChunks !== undefined
      ? `\n\nNote: This is chunk ${chunkIndex + 1} of ${totalChunks} of the document. Extract all requirements in this section. Requirements may continue in other chunks.`
      : "";

  return `${documentType.toUpperCase()} DOCUMENT:
${chunkNote}

${documentText}

Extract all requirements from the above document text.`;
}

/**
 * JSON schema for the tool definition (enforces structured output).
 */
export const EXTRACTION_OUTPUT_SCHEMA = {
  name: "extract_requirements",
  description: "Extract all requirements from a tender document",
  input_schema: {
    type: "object",
    properties: {
      requirements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text_en: { type: "string", description: "Requirement in English" },
            text_ar: {
              type: ["string", "null"],
              description: "Requirement in Arabic (null if document is English-only)",
            },
            section_ref: {
              type: ["string", "null"],
              description: "Section/clause reference e.g. 'Section 3.2.1'",
            },
            page_ref: {
              type: ["integer", "null"],
              description: "Approximate page number",
            },
            requirement_type: {
              type: "string",
              enum: ["mandatory", "optional", "informational", "conditional"],
            },
            priority: {
              type: "string",
              enum: ["critical", "high", "medium", "low"],
            },
            confidence_score: {
              type: "number",
              description: "Confidence 0.0-1.0",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Relevant tags",
            },
          },
          required: [
            "text_en",
            "requirement_type",
            "priority",
            "confidence_score",
          ],
        },
      },
      summary: {
        type: "object",
        properties: {
          total: { type: "integer" },
          mandatory: { type: "integer" },
          critical: { type: "integer" },
          language: { type: "string" },
        },
        required: ["total", "mandatory", "critical", "language"],
      },
    },
    required: ["requirements", "summary"],
  },
} as const;
