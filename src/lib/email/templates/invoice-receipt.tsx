import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { InvoicePaidPayload } from "../types";

export function subject(p: InvoicePaidPayload): string {
  return `Payment received — invoice ${p.invoiceNumber}`;
}

export default function InvoiceReceiptEmail(p: InvoicePaidPayload) {
  return (
    <EmailLayout
      preview={`We've received your payment for invoice ${p.invoiceNumber} — your ${p.planName} plan is active`}
    >
      <Heading>Payment received</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        Thanks — we&apos;ve recorded your payment of <strong>{p.amountPaid}</strong> for
        invoice <strong>{p.invoiceNumber}</strong> on {p.paidDate}.
      </Paragraph>
      <Paragraph>
        <strong>{p.organizationName}</strong> is now on the TenderOS{" "}
        <strong>{p.planName}</strong> plan, and all its features are active. This email is
        your receipt.
      </Paragraph>
      <CtaButton href={p.invoiceUrl} label="View billing" />
    </EmailLayout>
  );
}
