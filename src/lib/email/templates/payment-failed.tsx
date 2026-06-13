import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { PaymentFailedPayload } from "../types";

export function subject(p: PaymentFailedPayload): string {
  return `Action needed: payment failed for ${p.organizationName}`;
}

export default function PaymentFailedEmail(p: PaymentFailedPayload) {
  return (
    <EmailLayout
      preview={`We couldn't process the latest payment for ${p.organizationName}`}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      <Heading>We couldn&apos;t process your payment</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        The most recent payment for <strong>{p.organizationName}</strong>
        {p.amountDue ? (
          <>
            {" "}
            (<strong>{p.amountDue}</strong>)
          </>
        ) : null}{" "}
        didn&apos;t go through. This usually means an expired card or insufficient funds.
      </Paragraph>
      <Paragraph>
        Update your payment method to avoid any interruption to your workspace. We&apos;ll retry
        automatically once it&apos;s fixed.
      </Paragraph>
      <CtaButton href={p.updatePaymentUrl} label="Update payment method" />
    </EmailLayout>
  );
}
