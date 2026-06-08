import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { isOidcAuth } from "@/lib/auth/mode";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TenderOS — AI Tender & BOQ Intelligence for MENA Contractors",
    template: "%s | TenderOS",
  },
  description:
    "TenderOS extracts requirements and compliance matrices from 100+ page Arabic/English RFPs and BOQs in 90 seconds, then prices bids with a deterministic, float-safe engine — zero AI math hallucination. Built for construction, EPC, and facility-management firms in Saudi Arabia, the UAE, Qatar, and Egypt.",
  applicationName: "TenderOS",
  keywords: [
    "AI bid management software construction",
    "automated BOQ extraction",
    "BOQ pricing software",
    "tender management software MENA",
    "RFP compliance matrix automation",
    "construction estimating software Saudi Arabia",
    "EPC tender software UAE",
    "deterministic construction pricing",
    "Arabic RFP requirement extraction",
    "برنامج إدارة العطاءات للمقاولات",
    "أتمتة تسعير المقايسات",
    "برنامج تسعير المقايسات",
  ],
  authors: [{ name: "TenderOS" }],
  creator: "TenderOS",
  publisher: "TenderOS",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "ar_AE",
    url: SITE_URL,
    title: "TenderOS — The Operating System for Winning Contracts",
    description:
      "Extract Arabic/English BOQs in 90 seconds and price bids with a deterministic, zero-hallucination engine. For construction, EPC & FM firms across the Gulf and Egypt.",
    siteName: "TenderOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "TenderOS — AI Tender & BOQ Intelligence for MENA",
    description:
      "Messy Arabic/English RFPs & BOQs to structured requirements + float-safe pricing. Built for Gulf construction, EPC & FM.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tree = (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );

  // On-prem (OIDC): no Clerk context at all — auth is Keycloak/OIDC.
  if (isOidcAuth()) return tree;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2563eb", // brand blue
          colorBackground: "#ffffff",
          colorText: "#0F172A",
          colorInputBackground: "#f8fafc",
          borderRadius: "0.5rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        elements: {
          card: "shadow-xl border border-slate-200",
          headerTitle: "text-2xl font-bold text-slate-900",
          headerSubtitle: "text-slate-500",
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-medium",
          footerActionLink: "text-blue-600 hover:text-blue-700",
        },
      }}
    >
      {tree}
    </ClerkProvider>
  );
}
