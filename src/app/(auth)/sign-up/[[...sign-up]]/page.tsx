import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignUp } from "@clerk/nextjs";
import { BrandPanel } from "@/components/auth/brand-panel";
import { SsoSignIn } from "@/components/auth/sso-sign-in";
import { isOidcAuth } from "@/lib/auth/mode";
import { Logo } from "@/components/ui/logo";

export const metadata = {
  title: "Create Account",
};

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left: Brand panel (hidden on mobile) */}
      <BrandPanel />

      {/* Right: Auth form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        {/* Back to landing page */}
        <Link
          href="/"
          className="absolute left-4 top-5 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white sm:left-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        {/* Mobile-only logo */}
        <Link href="/" className="mb-8 lg:hidden">
          <Logo size={34} />
        </Link>

        <div className="w-full max-w-[400px]">
          {isOidcAuth() ? (
            <SsoSignIn
              title="Welcome"
              subtitle="Accounts are provisioned by your administrator. Sign in with SSO."
            />
          ) : (
          <SignUp
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl w-full",
                headerTitle:
                  "text-2xl font-bold text-slate-900 dark:text-slate-100",
                headerSubtitle: "text-slate-500 dark:text-slate-400",
                formButtonPrimary:
                  "bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm h-10 text-sm",
                formFieldInput:
                  "h-10 border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700 focus:ring-blue-600 focus:border-blue-600",
                formFieldLabel:
                  "text-sm font-medium text-slate-700 dark:text-slate-300",
                footerActionLink:
                  "text-blue-600 hover:text-blue-700 font-medium",
                socialButtonsBlockButton:
                  "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 h-10 text-sm font-medium",
                dividerLine: "bg-slate-200 dark:bg-slate-700",
                dividerText: "text-slate-400 text-xs",
                alert: "rounded-lg",
                footer: "bg-transparent",
                footerAction: "bg-transparent",
              },
              variables: {
                colorPrimary: "#2563eb",
                colorBackground: "#ffffff",
                colorText: "#0F172A",
                colorInputBackground: "#ffffff",
                borderRadius: "0.5rem",
                fontFamily: "Inter, system-ui, sans-serif",
                spacingUnit: "1rem",
              },
            }}
          />
          )}
        </div>
      </div>
    </div>
  );
}
