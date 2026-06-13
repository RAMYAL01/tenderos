import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { ApprovalRequestPayload } from "../types";

export function subject(p: ApprovalRequestPayload): string {
  return `Approval needed: "${p.proposalName}"`;
}

export default function ApprovalRequestEmail(p: ApprovalRequestPayload) {
  return (
    <EmailLayout
      preview={`${p.requestorName} submitted ${p.proposalName} for your approval`}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      <Heading>A proposal needs your approval</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        <strong>{p.requestorName}</strong> submitted <strong>{p.proposalName}</strong> (tender{" "}
        <strong>{p.tenderName}</strong>) for management review.
      </Paragraph>
      <Paragraph>
        Review the proposal and approve it or send it back with the changes you need.
      </Paragraph>
      <CtaButton href={p.reviewUrl} label="Review proposal" />
    </EmailLayout>
  );
}
