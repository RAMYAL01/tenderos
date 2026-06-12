import Link from "next/link";
import {
  ShieldCheck, Lock, Layers, ScrollText, Calculator, Server,
  KeyRound, EyeOff, Globe2, CheckCircle2, Clock4, ArrowRight,
} from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Trust Center",
  description:
    "How TenderOS protects tender data: strict tenant isolation, role-based access, append-only audit trails, deterministic pricing, and sovereign self-hosted deployment options.",
};

const CONTROLS = [
  {
    icon: Layers,
    title: "Strict tenant isolation",
    desc: "Every record is bound to your organization. Retrieval — including AI vector search — filters by tenant BEFORE ranking, so another customer's data can never be a candidate in your results.",
  },
  {
    icon: KeyRound,
    title: "Role-based access control",
    desc: "Seven workspace roles from Owner to Viewer, enforced server-side on every action. Approvals and decisions are gated to management roles; writers cannot approve their own work.",
  },
  {
    icon: ScrollText,
    title: "Append-only audit trail",
    desc: "Security-significant events — role changes, invitations, approvals, bid decisions, outcomes — are recorded immutably and exportable as CSV for your security reviews.",
  },
  {
    icon: Calculator,
    title: "Deterministic pricing — no AI math",
    desc: "Bid pricing is computed by an exact, integer-based engine. The AI extracts and drafts; it never sets a number. Every financial figure is reproducible and auditable.",
  },
  {
    icon: Lock,
    title: "Encryption & secret hygiene",
    desc: "Data is encrypted in transit (TLS) and at rest with our infrastructure providers. Invitation tokens and API keys are stored only as cryptographic hashes — a database leak exposes no usable credential.",
  },
  {
    icon: EyeOff,
    title: "Your data is never training material",
    desc: "We do not sell your data and do not allow customer content to train third-party foundation models. Optional model improvement uses only de-identified, aggregated data.",
  },
];

const DEPLOYMENTS = [
  {
    title: "Cloud",
    desc: "Multi-tenant SaaS on vetted infrastructure (Vercel, Neon Postgres). Fastest to start; tenant isolation enforced at the query layer on every read and write.",
  },
  {
    title: "Self-hosted",
    desc: "Run TenderOS inside your own infrastructure with your own identity provider (OIDC/Keycloak, federating Azure AD/ADFS), storage, and database.",
  },
  {
    title: "Air-gapped (sovereign)",
    desc: "The full platform — including local AI models for extraction, drafting, and OCR — operating with zero external calls, behind a deny-all egress firewall. Built for government data centres.",
  },
];

const COMPLIANCE: { label: string; status: "live" | "progress"; note: string }[] = [
  { label: "Tenant isolation & RBAC architecture", status: "live", note: "Enforced in code, covered by CI guard tests" },
  { label: "Append-only audit logging + export", status: "live", note: "Workspace Settings → Audit Log" },
  { label: "Air-gapped deployment reference", status: "live", note: "Docker Compose + Helm, zero-egress verified" },
  { label: "Data Processing Addendum (DPA)", status: "progress", note: "Available on request for enterprise agreements" },
  { label: "SOC 2 Type II", status: "progress", note: "Control framework in preparation" },
  { label: "ISO 27001", status: "progress", note: "Planned following SOC 2" },
  { label: "Regional regimes (NCA ECC, NESA)", status: "progress", note: "Control mapping maintained for sovereign deployments" },
];

export default function TrustPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-slate-100 dark:border-slate-800">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            aria-hidden="true"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(59,130,246,0.10), transparent)",
            }}
          />
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-600/25">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              Built for the most security-conscious buyers on earth
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Government tenders are sensitive by definition. TenderOS is engineered so your
              procurement data stays yours — isolated, auditable, and deployable entirely
              inside your own perimeter when sovereignty demands it.
            </p>
          </div>
        </section>

        {/* Security controls */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Security architecture
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {CONTROLS.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.title} className="rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                    <span className="inline-flex rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{c.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{c.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Deployment options */}
        <section className="bg-slate-50/60 py-16 dark:bg-slate-900/30 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Deploy where your data must live
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-400">
                From cloud to fully air-gapped sovereign environments — the same product,
                the same isolation guarantees.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {DEPLOYMENTS.map((d, i) => (
                <div key={d.title} className="rounded-2xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <span className="inline-flex rounded-xl bg-slate-100 p-2.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {i === 0 ? <Globe2 className="h-5 w-5" /> : i === 1 ? <Server className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{d.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{d.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Compliance — honest statuses */}
        <section className="py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Compliance posture
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-500">
              We publish our real status — what's enforced in the product today, and what's
              in preparation. No badge theatre.
            </p>
            <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              {COMPLIANCE.map((c, i) => (
                <div
                  key={c.label}
                  className={`flex items-start gap-3 px-5 py-3.5 ${i > 0 ? "border-t border-slate-100 dark:border-slate-800" : ""}`}
                >
                  {c.status === "live" ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Clock4 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.note}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      c.status === "live"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    {c.status === "live" ? "Live" : "In preparation"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Sub-processors and data-handling details are documented in our{" "}
              <Link href="/privacy" className="font-medium text-blue-600 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-slate-100 py-14 dark:border-slate-800">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 text-center sm:px-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Security questionnaire? Sovereign deployment?
            </h2>
            <p className="max-w-xl text-sm text-slate-500">
              We'll walk your security team through the architecture, the audit trail, and the
              air-gapped reference deployment.
            </p>
            <Button asChild>
              <a href="mailto:support@thetenderos.com">
                Talk to us <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
