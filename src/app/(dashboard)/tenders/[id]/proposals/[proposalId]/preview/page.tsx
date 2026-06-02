import { notFound } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { format } from "date-fns";
import { SECTION_TYPE_LABELS } from "@/lib/constants";
import type { SectionType } from "@prisma/client";

export const metadata = { title: "Proposal Preview" };

/**
 * Print-optimized proposal preview.
 * Opens in a new tab. User prints with Ctrl+P / Cmd+P to save as PDF.
 * Uses a clean, document-style layout with proper typography.
 */
export default async function ProposalPreviewPage({
  params,
}: {
  params: Promise<{ id: string; proposalId: string }>;
}) {
  const { org } = await getAuthContext();
  const { id: tenderId, proposalId } = await params;

  const proposal = await db.proposal.findFirst({
    where: { id: proposalId, orgId: org.id, deletedAt: null },
    include: {
      sections: {
        where: { deletedAt: null, OR: [{ contentEn: { not: null } }, { contentAr: { not: null } }] },
        orderBy: { orderIndex: "asc" },
      },
      tender: {
        select: {
          titleEn: true, titleAr: true,
          clientName: true, referenceNo: true, tenderType: true,
        },
      },
    },
  });

  if (!proposal) notFound();

  const isArabic = ["AR", "AR_SA", "AR_AE", "AR_EG"].includes(proposal.language);
  const isBilingual = proposal.language === "BILINGUAL";

  return (
    <html lang={isArabic ? "ar" : "en"} dir={isArabic ? "rtl" : "ltr"}>
      <head>
        <title>{proposal.title} — TenderOS</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Georgia:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a1a1a;
            background: white;
            padding: 0;
          }
          .page {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 60px;
          }
          @media print {
            body { padding: 0; }
            .page { max-width: none; padding: 0; margin: 0; }
            .no-print { display: none !important; }
            .section { page-break-inside: avoid; }
            h1, h2 { page-break-after: avoid; }
          }
          .cover { text-align: center; padding: 80px 40px; border-bottom: 2px solid #1a3a5c; margin-bottom: 60px; }
          .cover h1 { font-size: 22pt; color: #1a3a5c; margin-bottom: 16px; }
          .cover h2 { font-size: 14pt; color: #333; font-weight: normal; margin-bottom: 32px; }
          .cover .meta { font-size: 10pt; color: #666; line-height: 2; }
          .toc { margin-bottom: 60px; }
          .toc h2 { font-size: 14pt; color: #1a3a5c; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 16px; }
          .toc ol { padding-left: 24px; }
          .toc li { padding: 4px 0; font-size: 11pt; color: #333; }
          .section { margin-bottom: 48px; }
          .section h2 { font-size: 16pt; color: #1a3a5c; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; margin-bottom: 20px; }
          .section h3 { font-size: 12pt; color: #333; margin: 20px 0 10px; }
          .section p { margin-bottom: 12px; text-align: justify; }
          .section ul, .section ol { margin: 12px 0 12px 24px; }
          .section li { margin-bottom: 6px; }
          .ar-content { font-family: 'IBM Plex Sans Arabic', sans-serif; direction: rtl; text-align: right; margin-top: 24px; padding-top: 24px; border-top: 1px dashed #ccc; }
          .divider { border: none; border-top: 1px solid #e0e0e0; margin: 40px 0; }
          .print-btn {
            position: fixed; top: 20px; right: 20px; padding: 10px 20px;
            background: #1d4ed8; color: white; border: none; border-radius: 6px;
            font-size: 13px; cursor: pointer; font-family: system-ui;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .print-btn:hover { background: #1e40af; }
        `}</style>
      </head>
      <body>
        {/* Print button — hidden when printing */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <button className="print-btn no-print" onClick={"window.print()" as any}>
          🖨️ Print / Save as PDF
        </button>

        <div className="page">
          {/* Cover page */}
          <div className="cover">
            <h1>TECHNICAL PROPOSAL</h1>
            <h2>{proposal.tender.titleEn}</h2>
            {proposal.tender.titleAr && (
              <p style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: "13pt", color: "#333", marginBottom: "24px", direction: "rtl" }}>
                {proposal.tender.titleAr}
              </p>
            )}
            <div className="meta">
              {proposal.tender.clientName && <p><strong>Client:</strong> {proposal.tender.clientName}</p>}
              {proposal.tender.referenceNo && <p><strong>Reference:</strong> {proposal.tender.referenceNo}</p>}
              {proposal.tender.tenderType && <p><strong>Type:</strong> {proposal.tender.tenderType}</p>}
              <p><strong>Date:</strong> {format(new Date(), "d MMMM yyyy")}</p>
              <p><strong>Version:</strong> {proposal.currentVersion}</p>
            </div>
          </div>

          {/* Table of contents */}
          <div className="toc">
            <h2>Table of Contents</h2>
            <ol>
              {proposal.sections.map((s, idx) => {
                const label = SECTION_TYPE_LABELS[s.sectionType as SectionType]?.en ?? s.sectionType;
                return (
                  <li key={s.id}>
                    <a href={`#section-${s.id}`} style={{ color: "#1a3a5c", textDecoration: "none" }}>
                      {idx + 1}. {s.titleEn ?? label}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>

          <hr className="divider" />

          {/* Sections */}
          {proposal.sections.map((s, idx) => {
            const label = SECTION_TYPE_LABELS[s.sectionType as SectionType]?.en ?? s.sectionType;
            return (
              <div key={s.id} id={`section-${s.id}`} className="section">
                <h2>{idx + 1}. {s.titleEn ?? label}</h2>

                {s.contentEn && (
                  <div
                    dangerouslySetInnerHTML={{ __html: s.contentEn }}
                    className="section-content"
                  />
                )}

                {isBilingual && s.contentAr && (
                  <div
                    className="ar-content"
                    dangerouslySetInnerHTML={{ __html: s.contentAr }}
                  />
                )}

                {isArabic && s.contentAr && !s.contentEn && (
                  <div
                    className="ar-content"
                    style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}
                    dangerouslySetInnerHTML={{ __html: s.contentAr }}
                  />
                )}
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ marginTop: "60px", paddingTop: "20px", borderTop: "1px solid #ddd", textAlign: "center", fontSize: "9pt", color: "#999" }}>
            Generated by TenderOS · {format(new Date(), "d MMMM yyyy")} ·
            {proposal.tender.clientName && ` Prepared for ${proposal.tender.clientName}`}
          </div>
        </div>

        <script dangerouslySetInnerHTML={{
          __html: `
            // Auto-open print dialog
            document.querySelector('.print-btn').addEventListener('click', function() {
              window.print();
            });
          `
        }} />
      </body>
    </html>
  );
}
