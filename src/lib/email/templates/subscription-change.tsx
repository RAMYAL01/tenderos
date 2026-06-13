import * as React from "react";
import { CtaButton, EmailLayout, Heading, Paragraph } from "./_layout";
import type { SubscriptionChangePayload } from "../types";

/** Covers the billing lifecycle: TRIAL_STARTED, SUBSCRIPTION_UPGRADED, SUBSCRIPTION_CANCELLED. */
export function subject(p: SubscriptionChangePayload): string {
  switch (p.kind) {
    case "TRIAL_STARTED":
      return `Your TenderOS trial has started`;
    case "UPGRADED":
      return `You're now on the ${p.planName} plan`;
    case "CANCELLED":
      return `Your TenderOS subscription was cancelled`;
  }
}

export default function SubscriptionChangeEmail(p: SubscriptionChangePayload) {
  const billingUrl = p.billingUrl;
  return (
    <EmailLayout
      preview={subject(p)}
      preferencesUrl={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/settings/notifications`}
    >
      {p.kind === "TRIAL_STARTED" && (
        <>
          <Heading>Your trial is live 🚀</Heading>
          <Paragraph>Hi {p.recipientName},</Paragraph>
          <Paragraph>
            <strong>{p.organizationName}</strong>&apos;s trial of the <strong>{p.planName}</strong>{" "}
            plan has started{p.trialEndsOn ? <> and runs until <strong>{p.trialEndsOn}</strong></> : null}.
            You have full access — discovery, qualification, proposals, and BOQ pricing.
          </Paragraph>
          <CtaButton href={billingUrl} label="Manage billing" />
        </>
      )}

      {p.kind === "UPGRADED" && (
        <>
          <Heading>You&apos;re on {p.planName} 🎉</Heading>
          <Paragraph>Hi {p.recipientName},</Paragraph>
          <Paragraph>
            <strong>{p.organizationName}</strong> is now on the <strong>{p.planName}</strong> plan.
            Your new seats, AI credits, and discovery limits are active immediately.
          </Paragraph>
          <CtaButton href={billingUrl} label="View billing" />
        </>
      )}

      {p.kind === "CANCELLED" && (
        <>
          <Heading>Your subscription was cancelled</Heading>
          <Paragraph>Hi {p.recipientName},</Paragraph>
          <Paragraph>
            <strong>{p.organizationName}</strong>&apos;s subscription has been cancelled and the
            workspace has reverted to the free Starter limits. Your data is retained — you can
            re-subscribe anytime to restore full access.
          </Paragraph>
          <CtaButton href={billingUrl} label="Re-subscribe" />
        </>
      )}
    </EmailLayout>
  );
}
