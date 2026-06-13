import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { ApprovalResultPayload } from "../types";

/** APPROVAL_COMPLETED — tells the author their proposal was approved. */
export function subject(p: ApprovalResultPayload): string {
  return `Approved: "${p.proposalName}"`;
}

export default function ApprovalResultEmail(p: ApprovalResultPayload) {
  return (
    <EmailLayout
      preview={`${p.proposalName} was approved`}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      <Heading>Your proposal was approved ✅</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        <strong>{p.approverName}</strong> approved <strong>{p.proposalName}</strong> (tender{" "}
        <strong>{p.tenderName}</strong>). It&apos;s ready to export and submit.
      </Paragraph>
      <CtaButton href={p.proposalUrl} label="Open proposal" />
    </EmailLayout>
  );
}
