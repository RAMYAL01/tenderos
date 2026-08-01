import * as React from "react";
import { Section, Text } from "@react-email/components";
import { CtaButton, Divider, EmailLayout, Heading, Paragraph } from "./_layout";
import type { InvoiceIssuedPayload } from "../types";

export function subject(p: InvoiceIssuedPayload): string {
  return `Invoice ${p.invoiceNumber} — ${p.amountDue} due`;
}

export default function InvoiceIssuedEmail(p: InvoiceIssuedPayload) {
  return (
    <EmailLayout
      preview={`Invoice ${p.invoiceNumber} for ${p.organizationName} — ${p.amountDue} due ${p.dueDate}`}
    >
      <Heading>Invoice {p.invoiceNumber}</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        Here&apos;s the invoice for <strong>{p.organizationName}</strong>&apos;s TenderOS{" "}
        {p.planName} plan ({p.billingCycle}). It covers {p.periodLabel}.
      </Paragraph>

      {/* Line items */}
      <Section style={box}>
        {p.lineItems.map((li, i) => (
          <table key={i} style={rowTable} cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td style={descCell}>
                  {li.description}
                  {li.quantity > 1 ? ` × ${li.quantity}` : ""}
                </td>
                <td style={amtCell}>{li.amount}</td>
              </tr>
            </tbody>
          </table>
        ))}
        <Divider />
        <table style={rowTable} cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td style={totalLabelCell}>Total due</td>
              <td style={totalAmtCell}>{p.amountDue}</td>
            </tr>
          </tbody>
        </table>
        <Text style={dueText}>Due {p.dueDate}</Text>
      </Section>

      {/* Payment instructions */}
      {p.paymentInstructions ? (
        <>
          <Text style={instrHeading}>How to pay</Text>
          <Text style={instrBox}>{p.paymentInstructions}</Text>
          <Paragraph>
            Once you&apos;ve sent payment, open your billing page and click
            &ldquo;I&apos;ve sent payment&rdquo; so we can confirm and activate your plan.
          </Paragraph>
        </>
      ) : (
        <Paragraph>
          Reply to this email for payment details, or open your billing page below.
        </Paragraph>
      )}

      <CtaButton href={p.invoiceUrl} label="View invoice" />
    </EmailLayout>
  );
}

const box: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  padding: "18px 20px",
  margin: "8px 0 20px",
};
const rowTable: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const descCell: React.CSSProperties = {
  fontSize: "14px",
  color: "#334155",
  padding: "4px 0",
  textAlign: "left",
};
const amtCell: React.CSSProperties = {
  fontSize: "14px",
  color: "#334155",
  padding: "4px 0",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const totalLabelCell: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#0f172a",
  textAlign: "left",
};
const totalAmtCell: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#0f172a",
  textAlign: "right",
  whiteSpace: "nowrap",
};
const dueText: React.CSSProperties = {
  fontSize: "12px",
  color: "#64748b",
  margin: "8px 0 0",
  textAlign: "right",
};
const instrHeading: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 6px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const instrBox: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: "1.6",
  color: "#334155",
  backgroundColor: "#f1f5f9",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "12px 14px",
  margin: "0 0 14px",
  whiteSpace: "pre-wrap",
};
