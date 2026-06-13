import * as React from "react";
import { Link, Section, Text } from "@react-email/components";
import { CtaButton, Divider, EmailLayout, Heading, Paragraph } from "./_layout";
import type { DailyDigestPayload } from "../types";

export function subject(p: DailyDigestPayload): string {
  const n = p.opportunities.length;
  return `${n} new tender match${n === 1 ? "" : "es"} for ${p.organizationName}`;
}

export default function DailyDigestEmail(p: DailyDigestPayload) {
  return (
    <EmailLayout
      preview={`${p.opportunities.length} new opportunities matched your profile`}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      <Heading>Your daily tender matches</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        {p.opportunities.length} new {p.opportunities.length === 1 ? "opportunity" : "opportunities"}{" "}
        matched <strong>{p.organizationName}</strong>&apos;s profile since yesterday, highest
        relevance first.
      </Paragraph>

      <Divider />

      {p.opportunities.map((o, i) => (
        <Section key={i} style={row}>
          <Link href={o.url} style={title}>
            {o.title}
          </Link>
          <Text style={meta}>
            <span style={scorePill}>{Math.round(o.score * 100)}% match</span>
            {o.buyerName ? <> · {o.buyerName}</> : null}
            {o.country ? <> · {o.country}</> : null}
            {o.closingDate ? <> · closes {o.closingDate}</> : null}
          </Text>
        </Section>
      ))}

      <CtaButton href={p.discoverUrl} label="View all opportunities" />
    </EmailLayout>
  );
}

const row: React.CSSProperties = { margin: "0 0 16px" };
const title: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#1e293b",
  textDecoration: "none",
  lineHeight: "1.4",
};
const meta: React.CSSProperties = { fontSize: "12px", color: "#64748b", margin: "4px 0 0" };
const scorePill: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  color: "#2563eb",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "999px",
};
