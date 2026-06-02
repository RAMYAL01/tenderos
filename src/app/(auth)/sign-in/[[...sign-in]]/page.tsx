import { SignIn } from "@clerk/nextjs";

export const metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4">
      {/* Decorative background pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 75% 75%, #1d4ed8 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">TenderOS</h1>
          <p className="mt-1 text-sm text-slate-400">
            The Operating System for Winning Contracts
          </p>
          {/* Arabic tagline */}
          <p className="mt-1 text-xs text-slate-500" dir="rtl">
            نظام تشغيل الفوز بالعقود
          </p>
        </div>

        <SignIn />
      </div>
    </div>
  );
}
