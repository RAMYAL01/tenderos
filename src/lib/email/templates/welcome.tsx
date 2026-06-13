import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { WelcomePayload } from "../types";

export function subject(p: WelcomePayload): string {
  return `Welcome to TenderOS, ${p.organizationName}`;
}

export default function WelcomeEmail(p: WelcomePayload) {
  return (
    <EmailLayout preview={`${p.organizationName} is set up on TenderOS — here's how to start`}>
      <Heading>Welcome aboard, {p.recipientName} 👋</Heading>
      <Paragraph>
        <strong>{p.organizationName}</strong> is now set up on TenderOS on the{" "}
        <strong>{p.planName}</strong> plan. You&apos;re ready to run your first bid end to end.
      </Paragraph>
      <Paragraph>
        <strong>Next steps:</strong>
      </Paragraph>
      <Paragraph>
        1. Review your personalized <strong>Discover</strong> feed of matching tenders.
        <br />
        2. Run a <strong>Bid/No-Bid</strong> qualification on one that fits.
        <br />
        3. Invite your team and start a <strong>proposal</strong>.
      </Paragraph>
      <CtaButton href={p.dashboardUrl} label="Open your dashboard" />
      <Paragraph>
        Questions? Just reply to this email — it reaches our team directly.
      </Paragraph>
    </EmailLayout>
  );
}
