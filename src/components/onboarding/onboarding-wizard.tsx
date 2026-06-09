"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Rocket,
  Zap,
  Users,
  FileUp,
  Library,
  FileText,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveCompanyProfile,
  completeOnboarding,
  type CompanyProfileInput,
} from "@/lib/actions/onboarding";

const ORG_TYPES: { value: CompanyProfileInput["organizationType"]; label: string }[] = [
  { value: "GENERAL_CONTRACTOR", label: "General Contractor" },
  { value: "EPC_CONTRACTOR", label: "EPC Contractor" },
  { value: "CONSTRUCTION_COMPANY", label: "Construction Company" },
  { value: "ENGINEERING_CONSULTANT", label: "Engineering Consultant" },
  { value: "FACILITIES_MANAGEMENT", label: "Facilities Management Company" },
  { value: "GOVERNMENT_AGENCY", label: "Government Agency" },
  { value: "SUPPLIER_VENDOR", label: "Supplier / Vendor" },
  { value: "OTHER", label: "Other" },
];

const EMPLOYEE_BANDS = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

const COUNTRIES = [
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "EG", label: "Egypt" },
  { code: "QA", label: "Qatar" },
  { code: "KW", label: "Kuwait" },
  { code: "OM", label: "Oman" },
  { code: "BH", label: "Bahrain" },
  { code: "JO", label: "Jordan" },
  { code: "IQ", label: "Iraq" },
  { code: "OTHER", label: "Other" },
];

const PLANS = [
  {
    tier: "STARTER" as const,
    name: "Starter",
    monthly: 149,
    icon: Rocket,
    blurb: "Small contractors getting started.",
    features: ["3 team seats", "5 proposals / mo", "50 AI credits", "2 GB storage"],
  },
  {
    tier: "PROFESSIONAL" as const,
    name: "Professional",
    monthly: 499,
    icon: Zap,
    blurb: "Growing firms running multiple bids.",
    features: ["10 team seats", "20 proposals / mo", "250 AI credits", "Content library"],
    recommended: true,
  },
  {
    tier: "BUSINESS" as const,
    name: "Business",
    monthly: 1299,
    icon: Building2,
    blurb: "High bid volume, dedicated teams.",
    features: ["30 team seats", "Unlimited proposals", "1,000 AI credits", "Advanced analytics"],
  },
];

type Props = {
  /** Whether a company workspace (Clerk org) already exists. If false, Step 1 creates it. */
  hasOrg: boolean;
  member: { name: string };
  org: {
    name: string;
    organizationType: string | null;
    countryCode: string | null;
    employeeCount: string | null;
    website: string | null;
    planTier: string;
  };
  setup: {
    profileDone: boolean;
    teamInvited: boolean;
    tenderUploaded: boolean;
    knowledgeUploaded: boolean;
    proposalCreated: boolean;
  };
};

const STEPS = ["Company Workspace", "Choose Plan", "Get Started"];

export function OnboardingWizard({ hasOrg, member, org, setup }: Props) {
  const router = useRouter();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [step, setStep] = useState(setup.profileDone ? 1 : 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 form state
  const [form, setForm] = useState({
    name: org.name ?? "",
    organizationType: (org.organizationType ?? "") as string,
    countryCode: org.countryCode ?? "",
    employeeCount: org.employeeCount ?? "",
    website: org.website ?? "",
  });

  // Step 2 plan selection
  const [plan, setPlan] = useState<string>(
    org.planTier && org.planTier !== "STARTER" ? org.planTier : "PROFESSIONAL"
  );

  function submitProfile() {
    setError(null);
    if (!form.name.trim() || !form.organizationType || !form.countryCode || !form.employeeCount) {
      setError("Please complete the required fields.");
      return;
    }
    startTransition(async () => {
      try {
        // No workspace yet → create the company (Clerk organization) and make it
        // the active org for this session. This is the heart of org-first signup:
        // the COMPANY is created here, not a personal account.
        if (!hasOrg) {
          if (!isLoaded || !createOrganization || !setActive) {
            setError("Still loading — please try again in a moment.");
            return;
          }
          const newOrg = await createOrganization({ name: form.name.trim() });
          await setActive({ organization: newOrg.id });
        }

        // Persist the company profile (the org is now active in the session).
        const res = await saveCompanyProfile(form as CompanyProfileInput);
        if (!res.success) {
          setError(res.error ?? "Could not save.");
          return;
        }
        router.refresh();
        setStep(1);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not create your company workspace."
        );
      }
    });
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding();
      if (!res.success) {
        setError(res.error ?? "Could not finish.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Logo size={30} />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Welcome, {member.name.split(" ")[0]}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Stepper */}
        <ol className="mb-10 flex items-center justify-center gap-2 sm:gap-4">
          {STEPS.map((label, i) => {
            const active = i === step;
            const done = i < step;
            return (
              <li key={label} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                      done && "bg-blue-600 text-white",
                      active && "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950",
                      !done && !active && "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "hidden text-sm font-medium sm:inline",
                      active ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-700" />
                )}
              </li>
            );
          })}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          {/* ───────────── Step 1: Company Workspace ───────────── */}
          {step === 0 && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Create your company workspace
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                TenderOS is built around your company. Everyone you invite shares this workspace,
                its plan, and its data.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Company name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Al Faisal Contracting Co."
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="orgType">Organization type *</Label>
                  <select
                    id="orgType"
                    value={form.organizationType}
                    onChange={(e) => setForm((f) => ({ ...f, organizationType: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">Select type…</option>
                    {ORG_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="country">Country *</Label>
                  <select
                    id="country"
                    value={form.countryCode}
                    onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">Select country…</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code === "OTHER" ? "" : c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="employees">Number of employees *</Label>
                  <select
                    id="employees"
                    value={form.employeeCount}
                    onChange={(e) => setForm((f) => ({ ...f, employeeCount: e.target.value }))}
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">Select size…</option>
                    {EMPLOYEE_BANDS.map((b) => (
                      <option key={b} value={b}>
                        {b} employees
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                    placeholder="https://company.com"
                    className="mt-1.5"
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              <div className="mt-8 flex justify-end">
                <Button onClick={submitProfile} disabled={pending} size="lg">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Continue
                  {!pending && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* ───────────── Step 2: Choose Plan ───────────── */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Choose your organization plan
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Every plan starts with a <span className="font-semibold text-blue-600">14-day free trial</span>.
                No card required now — pick what fits, change it anytime in billing.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {PLANS.map((p) => {
                  const selected = plan === p.tier;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.tier}
                      type="button"
                      onClick={() => setPlan(p.tier)}
                      className={cn(
                        "relative flex flex-col rounded-xl border-2 p-5 text-left transition-all",
                        selected
                          ? "border-blue-600 bg-blue-50/50 shadow-md dark:bg-blue-950/30"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                      )}
                    >
                      {p.recommended && (
                        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <Sparkles className="h-3 w-3" /> Recommended
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <Icon className={cn("h-5 w-5", selected ? "text-blue-600" : "text-slate-400")} />
                        {selected && <Check className="h-5 w-5 text-blue-600" />}
                      </div>
                      <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.blurb}</p>
                      <div className="mt-3">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">
                          ${p.monthly}
                        </span>
                        <span className="text-sm text-slate-500">/mo</span>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <Check className="h-3.5 w-3.5 shrink-0 text-blue-500" /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(0)} disabled={pending}>
                  Back
                </Button>
                <Button onClick={() => setStep(2)} disabled={pending} size="lg">
                  Start 14-day trial
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ───────────── Step 3: Get Started ───────────── */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
                  <Check className="h-5 w-5 text-green-600" />
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Your workspace is ready
                </h1>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Trial active. Knock out these steps to get your first AI-priced proposal — or jump
                straight into the dashboard.
              </p>

              <div className="mt-6 space-y-3">
                <ChecklistItem
                  done={setup.teamInvited}
                  icon={Users}
                  title="Invite your team"
                  desc="Add colleagues to the workspace and assign roles."
                  href="/settings/members"
                  cta="Invite"
                />
                <ChecklistItem
                  done={setup.tenderUploaded}
                  icon={FileUp}
                  title="Upload your first tender"
                  desc="Drop an RFP / BOQ — TenderOS extracts requirements automatically."
                  href="/tenders/new"
                  cta="Upload"
                />
                <ChecklistItem
                  done={setup.knowledgeUploaded}
                  icon={Library}
                  title="Add historical documents"
                  desc="Past proposals power the AI's grounded, on-brand drafting."
                  href="/library"
                  cta="Add"
                />
                <ChecklistItem
                  done={setup.proposalCreated}
                  icon={FileText}
                  title="Generate a proposal"
                  desc="Turn an extracted tender into a compliant draft."
                  href="/tenders"
                  cta="Start"
                />
              </div>

              {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

              <div className="mt-8 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                  Back
                </Button>
                <Button onClick={finish} disabled={pending} size="lg">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Go to dashboard
                  {!pending && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({
  done,
  icon: Icon,
  title,
  desc,
  href,
  cta,
}: {
  done: boolean;
  icon: typeof Users;
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border p-4 transition-colors",
        done
          ? "border-green-200 bg-green-50/60 dark:border-green-900/50 dark:bg-green-950/20"
          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          done ? "bg-green-100 dark:bg-green-950" : "bg-slate-100 dark:bg-slate-800"
        )}
      >
        {done ? (
          <Check className="h-5 w-5 text-green-600" />
        ) : (
          <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <Button asChild variant={done ? "outline" : "secondary"} size="sm">
        <Link href={href}>{done ? "View" : cta}</Link>
      </Button>
    </div>
  );
}
