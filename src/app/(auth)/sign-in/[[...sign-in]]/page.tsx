import { SignIn } from "@clerk/nextjs";
import { BrandPanel } from "@/components/auth/brand-panel";
import { Logo } from "@/components/ui/logo";

export const metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left: Brand panel (hidden on mobile) */}
      <BrandPanel />

      {/* Right: Auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        {/* Mobile-only logo (hidden when brand panel is visible) */}
        <div className="mb-8 lg:hidden">
          <Logo size={34} />
        </div>

        <div className="w-full max-w-[400px]">
          <SignIn
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
                identityPreview:
                  "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
                formResendCodeLink: "text-blue-600 hover:text-blue-700",
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
        </div>
      </div>
    </div>
  );
}
