import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { TrialEndingPayload } from "../types";

export function subject(p: TrialEndingPayload): string {
  if (p.daysLeft <= 1) return `Your TenderOS trial ends tomorrow`;
  return `Your TenderOS trial ends in ${p.daysLeft} days`;
}

export default function TrialEndingEmail(p: TrialEndingPayload) {
  return (
    <EmailLayout
      preview={`${p.daysLeft} day(s) left on your TenderOS trial`}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      <Heading>
        {p.daysLeft <= 1 ? "Your trial ends tomorrow" : `${p.daysLeft} days left on your trial`}
      </Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        Your <strong>{p.organizationName}</strong> trial on TenderOS ends on{" "}
        <strong>{p.endsOn}</strong>. To keep your discovery feed, saved searches, proposals, and
        team access without interruption, add a plan now.
      </Paragraph>
      <CtaButton href={p.upgradeUrl} label="Choose a plan" />
      <Paragraph>
        Your work is safe either way — nothing is deleted when a trial ends.
      </Paragraph>
    </EmailLayout>
  );
}
