import Link from "next/link";
import { Building2, MailWarning, Clock, ShieldCheck } from "lucide-react";
import { db } from "@/lib/prisma";
import { isOidcAuth } from "@/lib/auth/mode";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { AcceptInvitationCard } from "@/components/onboarding/accept-invitation-card";

export const metadata = { title: "Join workspace · TenderOS" };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SENIOR_WRITER: "Senior Writer",
  WRITER: "Writer",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
      <Logo size={34} className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true, logoUrl: true } } },
  });

  // Invalid / used / expired states
  if (!invitation || invitation.status === "REVOKED") {
    return (
      <Shell>
        <div className="text-center">
          <MailWarning className="mx-auto h-10 w-10 text-slate-400" />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Invitation not found
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            This invitation link is invalid or was revoked. Ask your workspace admin to send a new one.
          </p>
        </div>
      </Shell>
    );
  }

  if (invitation.status === "ACCEPTED") {
    return (
      <Shell>
        <div className="text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-green-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Already accepted
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            You&apos;ve already joined {invitation.organization.name}.
          </p>
          <Button asChild className="mt-5 w-full">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (invitation.status === "EXPIRED" || invitation.expiresAt.getTime() < Date.now()) {
    return (
      <Shell>
        <div className="text-center">
          <Clock className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Invitation expired
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ask your workspace admin to send a fresh invite link.
          </p>
        </div>
      </Shell>
    );
  }

  // OIDC / air-gapped: membership is provisioned by the identity provider.
  if (isOidcAuth()) {
    return (
      <Shell>
        <div className="text-center">
          <Building2 className="mx-auto h-10 w-10 text-blue-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            SSO-managed workspace
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {invitation.organization.name} provisions members through your identity provider.
            Ask your administrator to grant you access, then sign in with SSO.
          </p>
        </div>
      </Shell>
    );
  }

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();

  // Not signed in → send to sign-in, returning here afterward.
  if (!userId) {
    const returnTo = encodeURIComponent(`/invite/${token}`);
    return (
      <Shell>
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
            <Building2 className="h-6 w-6 text-blue-600" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Join {invitation.organization.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            You&apos;ve been invited as{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {ROLE_LABEL[invitation.role] ?? invitation.role}
            </span>
            . Sign in as <span className="font-medium">{invitation.email}</span> to accept.
          </p>
          <div className="mt-6 space-y-2">
            <Button asChild className="w-full">
              <Link href={`/sign-in?redirect_url=${returnTo}`}>Sign in to accept</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/sign-up?redirect_url=${returnTo}`}>Create an account</Link>
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  // Signed in → render the accept action.
  return (
    <Shell>
      <AcceptInvitationCard
        token={token}
        orgName={invitation.organization.name}
        email={invitation.email}
        roleLabel={ROLE_LABEL[invitation.role] ?? invitation.role}
      />
    </Shell>
  );
}
