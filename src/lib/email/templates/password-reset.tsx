import * as React from "react";
import { CtaButton, EmailLayout, FallbackLink, Heading, Paragraph } from "./_layout";
import type { PasswordResetPayload } from "../types";

/**
 * NOTE: In the CLOUD edition, password reset is owned by Clerk (which already
 * issues secure, enumeration-safe reset links). This template exists for the
 * self-hosted / Keycloak edition and any future first-party reset flow — it is
 * NOT wired to a custom token issuer in the hosted app. See
 * docs/email-infrastructure.md.
 */

export function subject(): string {
  return `Reset your TenderOS password`;
}

export default function PasswordResetEmail(p: PasswordResetPayload) {
  return (
    <EmailLayout preview="Reset your TenderOS password">
      <Heading>Reset your password</Heading>
      <Paragraph>Hi {p.recipientName},</Paragraph>
      <Paragraph>
        We received a request to reset your TenderOS password. Click below to choose a new one.
        This link expires in {p.expiresInMinutes} minutes.
      </Paragraph>
      <CtaButton href={p.resetUrl} label="Reset password" />
      <Paragraph>
        If you didn&apos;t request this, you can safely ignore this email — your password
        won&apos;t change.
      </Paragraph>
      <FallbackLink href={p.resetUrl} />
    </EmailLayout>
  );
}
