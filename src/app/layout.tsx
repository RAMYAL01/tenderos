import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TenderOS — The Operating System for Winning Contracts",
    template: "%s | TenderOS",
  },
  description:
    "AI-powered proposal intelligence platform for government contractors, construction, engineering, and defense companies in MENA and globally.",
  keywords: [
    "proposal management",
    "tender software",
    "RFP response",
    "compliance matrix",
    "MENA procurement",
    "Arabic tender",
    "government contracting",
  ],
  authors: [{ name: "TenderOS" }],
  creator: "TenderOS",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "ar_AE",
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: "TenderOS — The Operating System for Winning Contracts",
    description:
      "AI-powered bilingual (Arabic/English) proposal intelligence for MENA contractors.",
    siteName: "TenderOS",
  },
  robots: {
    index: true,
    follow: true,
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
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2563eb",         // brand blue
          colorBackground: "#ffffff",
          colorText: "#0F172A",
          colorInputBackground: "#f8fafc",
          borderRadius: "0.5rem",
          fontFamily: "Inter, system-ui, sans-serif",
        },
        elements: {
          // Consistent card style for auth pages
          card: "shadow-xl border border-slate-200",
          headerTitle: "text-2xl font-bold text-slate-900",
          headerSubtitle: "text-slate-500",
          formButtonPrimary:
            "bg-blue-600 hover:bg-blue-700 text-white font-medium",
          footerActionLink: "text-blue-600 hover:text-blue-700",
        },
      }}
    >
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
    </ClerkProvider>
  );
}
