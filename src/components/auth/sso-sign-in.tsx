import { LogIn, ShieldCheck } from "lucide-react";

/**
 * On-prem SSO sign-in card (shown when AUTH_PROVIDER=oidc instead of Clerk).
 * Links to the OIDC login route, which redirects to the identity provider
 * (Keycloak → Azure AD / ADFS). Accounts are provisioned by the IdP.
 */
export function SsoSignIn({
  title = "Sign in",
  subtitle = "Continue with your organization's single sign-on.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
        <ShieldCheck className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">{subtitle}</p>
      <a
        href="/api/auth/oidc/login"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-blue-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:to-blue-700"
      >
        <LogIn className="h-4 w-4" />
        Continue with SSO
      </a>
      <p className="mt-4 text-xs text-slate-400">
        Access is managed by your administrator. Contact IT if you can&apos;t sign in.
      </p>
    </div>
  );
}
