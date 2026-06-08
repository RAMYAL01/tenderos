"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { Building2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/actions/accept-invitation";

export function AcceptInvitationCard({
  token,
  orgName,
  email,
  roleLabel,
}: {
  token: string;
  orgName: string;
  email: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const { setActive, isLoaded } = useOrganizationList();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvitation(token);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Make the joined workspace the active org, then enter the product.
      try {
        if (isLoaded && setActive) {
          await setActive({ organization: res.clerkOrgId });
        }
      } catch {
        /* non-fatal — getAuthContext will still resolve on next load */
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950">
        <Building2 className="h-6 w-6 text-blue-600" />
      </span>
      <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
        Join {orgName}
      </h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        You&apos;ve been invited as{" "}
        <span className="font-medium text-slate-700 dark:text-slate-200">{roleLabel}</span>. This
        adds <span className="font-medium">{email}</span> to the shared company workspace.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <Button onClick={accept} disabled={pending} className="mt-6 w-full" size="lg">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Accept &amp; join
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>
    </div>
  );
}
