import * as React from "react";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * Shared branded shell for every TenderOS email. Keeps header, footer,
 * typography, and the CAN-SPAM essentials (postal identity + manage-preferences
 * link) in one place so individual templates only declare their content.
 *
 * All styling is inline + table-safe (React Email handles the rendering) so it
 * survives Gmail / Outlook / Apple Mail.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export interface LayoutProps {
  /** Inbox preview line (hidden in the body). */
  preview: string;
  /** Footer "manage preferences" link target; omit for transactional mail. */
  preferencesUrl?: string;
  children: React.ReactNode;
}

export function EmailLayout({ preview, preferencesUrl, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Brand header */}
          <Section style={header}>
            <Link href={APP_URL} style={brand}>
              Tender<span style={brandAccent}>OS</span>
            </Link>
          </Section>

          {/* Content card */}
          <Section style={card}>{children}</Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              TenderOS — The Operating System for Winning Contracts
            </Text>
            <Text style={footerMuted}>
              {preferencesUrl ? (
                <>
                  <Link href={preferencesUrl} style={footerLink}>
                    Manage email preferences
                  </Link>
                  {"  ·  "}
                </>
              ) : null}
              <Link href={`${APP_URL}/contact`} style={footerLink}>
                Contact support
              </Link>
            </Text>
            <Text style={footerMuted}>
              You received this because you&apos;re a member of a TenderOS workspace.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Reusable content atoms (so templates stay declarative) ─────────────────────

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={heading}>{children}</Text>;
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={paragraph}>{children}</Text>;
}

export function CtaButton({ href, label }: { href: string; label: string }) {
  // Plain anchor styled as a button — most reliable across mail clients.
  return (
    <Section style={{ textAlign: "center", margin: "28px 0 8px" }}>
      <Link href={href} style={button}>
        {label}
      </Link>
    </Section>
  );
}

export function Divider() {
  return <Hr style={hr} />;
}

export function FallbackLink({ href }: { href: string }) {
  return (
    <Text style={fallback}>
      Or paste this link into your browser:
      <br />
      <Link href={href} style={fallbackLink}>
        {href}
      </Link>
    </Text>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: "#f1f5f9",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  margin: 0,
  padding: "24px 0",
};
const container: React.CSSProperties = { maxWidth: "560px", margin: "0 auto", padding: "0 16px" };
const header: React.CSSProperties = { padding: "8px 0 20px", textAlign: "center" };
const brand: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#0f172a",
  textDecoration: "none",
  letterSpacing: "-0.02em",
};
const brandAccent: React.CSSProperties = { color: "#2563eb" };
const card: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  padding: "32px",
};
const heading: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 700,
  color: "#0f172a",
  margin: "0 0 12px",
  lineHeight: "1.3",
};
const paragraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#334155",
  margin: "0 0 14px",
};
const button: React.CSSProperties = {
  backgroundColor: "#2563eb",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "12px 28px",
  borderRadius: "10px",
  display: "inline-block",
};
const hr: React.CSSProperties = { borderColor: "#e2e8f0", margin: "24px 0" };
const fallback: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#94a3b8",
  margin: "16px 0 0",
  wordBreak: "break-all",
};
const fallbackLink: React.CSSProperties = { color: "#2563eb", fontSize: "12px" };
const footer: React.CSSProperties = { padding: "20px 8px", textAlign: "center" };
const footerText: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#475569",
  margin: "0 0 6px",
};
const footerMuted: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  margin: "0 0 4px",
};
const footerLink: React.CSSProperties = { color: "#64748b", textDecoration: "underline" };
