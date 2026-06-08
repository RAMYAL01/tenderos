import { BoqReviewScreen } from "@/components/boq/boq-review-screen";

export const metadata = {
  title: "BOQ Review · TenderOS",
};

/**
 * Standalone, full-screen HITL review for AI/OCR-extracted Bills of Quantities.
 * Rendered outside the dashboard shell for an immersive split-screen workspace.
 *
 * Currently mounts with built-in mock data. To wire to a real extraction, pass:
 *   <BoqReviewScreen
 *     initialRows={mapExtractionToRows(extraction)}
 *     documentUrl={signedScanUrl}
 *     tenderName={tender.title}
 *     onApprove={(rows) => priceBoq(rows)}
 *   />
 */
export default function BoqReviewPage() {
  return <BoqReviewScreen />;
}
