import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { ProposalReadyPayload } from "../types";

export function subject(p: ProposalReadyPayload): string {
  return `Your proposal "${p.proposalName}" is ready`;
}

export default function ProposalReadyEmail(p: ProposalReadyPayload) {
  return (
    <EmailLayout
      preview={`The draft for ${p.tenderName} is ready to review`}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      <Heading>Your proposal draft is ready</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        The AI draft for <strong>{p.proposalName}</strong> on tender{" "}
        <strong>{p.tenderName}</strong> has finished generating and is ready for your review.
      </Paragraph>
      <Paragraph>
        Open it to refine the sections, run compliance and BOQ pricing, then submit it for
        approval.
      </Paragraph>
      <CtaButton href={p.proposalUrl} label="Open proposal" />
    </EmailLayout>
  );
}
