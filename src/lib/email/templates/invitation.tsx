import * as React from "react";
import { CtaButton, EmailLayout, FallbackLink, Heading, Paragraph } from "./_layout";
import type { InvitationPayload } from "../types";

export function subject(p: InvitationPayload): string {
  return `You've been invited to join ${p.organizationName} on TenderOS`;
}

export default function InvitationEmail(p: InvitationPayload) {
  return (
    <EmailLayout preview={`Join ${p.organizationName} on TenderOS as ${p.role}`}>
      <Heading>You&apos;ve been invited to {p.organizationName}</Heading>
      <Paragraph>
        <strong>{p.inviterName}</strong> has invited you to join the{" "}
        <strong>{p.organizationName}</strong> workspace on TenderOS as a{" "}
        <strong>{p.role}</strong>.
      </Paragraph>
      <Paragraph>
        TenderOS is the bid-to-award platform their team uses to discover tenders, qualify
        bids, build compliant proposals, and price BOQs. Accept the invitation to get started.
      </Paragraph>
      <CtaButton href={p.acceptUrl} label="Accept invitation" />
      <Paragraph>
        This invitation expires in {p.expiresInDays} days. If you weren&apos;t expecting it,
        you can safely ignore this email.
      </Paragraph>
      <FallbackLink href={p.acceptUrl} />
    </EmailLayout>
  );
}
