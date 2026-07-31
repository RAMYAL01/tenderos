import type { Invoice, InvoiceStatus, PlanTier } from "@prisma/client";
import { db } from "@/lib/prisma";
import { PLAN_LIMITS } from "@/lib/constants";
import { applyPlanToOrg } from "./sync";
import type { BillingCycle } from "./stripe";

/**
 * Manual invoicing.
 *
 * No card processor onboards our current entity, so billing is operator-driven:
 * the operator issues an invoice, the customer pays off-platform (bank transfer
 * / wire), and marking the invoice PAID activates the plan through the SAME
 * applyPlanToOrg() path Stripe used — so quota limits stay consistent no matter
 * how the org was billed.
 *
 * Money is handled in MINOR units (cents) end-to-end to avoid float bugs.
 */

const ANNUAL_DISCOUNT = 0.8; // 20% off, matches the pricing table
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  /** Per-unit price in minor units (cents). */
  unitAmount: number;
  /** quantity × unitAmount, in minor units. */
  amount: number;
}

/**
 * Suggested total (cents) for a tier + cycle, from the published list price.
 * Annual applies the 20% discount across 12 months. ENTERPRISE is custom
 * (price 0) — the operator sets the amount by hand.
 */
export function suggestedAmountCents(
  tier: PlanTier,
  cycle: BillingCycle
): number {
  const monthly = PLAN_LIMITS[tier].price;
  if (monthly === 0) return 0; // Enterprise / custom
  if (cycle === "annual") {
    return Math.round(monthly * ANNUAL_DISCOUNT) * 12 * 100;
  }
  return monthly * 100;
}

/** Number of days a billing period covers. */
export function cycleDays(cycle: BillingCycle): number {
  return cycle === "annual" ? 365 : 30;
}

/** Format minor units as a localized currency string (e.g. "$1,299.00"). */
export function formatMoney(amountCents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

/** Build the default single line item describing the plan subscription. */
export function defaultLineItems(
  tier: PlanTier,
  cycle: BillingCycle,
  amountCents: number
): InvoiceLineItem[] {
  const label = PLAN_LIMITS[tier].label;
  const period = cycle === "annual" ? "annual" : "monthly";
  return [
    {
      description: `TenderOS ${label} plan — ${period} subscription`,
      quantity: 1,
      unitAmount: amountCents,
      amount: amountCents,
    },
  ];
}

export interface CreateInvoiceInput {
  orgId: string;
  planTier: PlanTier;
  billingCycle: BillingCycle;
  /** Total payable in minor units. Defaults to the suggested list price. */
  amountCents?: number;
  currency?: string;
  /** Days until the invoice is due (from now). Default 14. */
  dueInDays?: number;
  /** Length of the billing period in days. Default derives from the cycle. */
  periodDays?: number;
  paymentInstructions?: string;
  notes?: string;
  lineItems?: InvoiceLineItem[];
  createdByUserId?: string;
  /** Issue immediately (DRAFT → SENT) instead of leaving as a draft. */
  sendNow?: boolean;
}

/**
 * Create an invoice for an org. Generates a sequential, human-facing number
 * (`TOS-<year>-<seq>`) inside a transaction so concurrent creates don't collide.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const {
    orgId,
    planTier,
    billingCycle,
    currency = "USD",
    dueInDays = 14,
    createdByUserId,
    sendNow = true,
  } = input;

  const amountCents = input.amountCents ?? suggestedAmountCents(planTier, billingCycle);
  const periodDays = input.periodDays ?? cycleDays(billingCycle);
  const lineItems =
    input.lineItems ?? defaultLineItems(planTier, billingCycle, amountCents);

  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + periodDays * MS_PER_DAY);
  const dueAt = new Date(now.getTime() + dueInDays * MS_PER_DAY);

  return db.$transaction(async (tx) => {
    const year = now.getFullYear();
    const prefix = `TOS-${year}-`;
    const countThisYear = await tx.invoice.count({
      where: { number: { startsWith: prefix } },
    });
    const number = `${prefix}${String(countThisYear + 1).padStart(4, "0")}`;

    return tx.invoice.create({
      data: {
        orgId,
        number,
        status: sendNow ? "SENT" : "DRAFT",
        planTier,
        billingCycle,
        currency,
        amountDue: amountCents,
        lineItems: lineItems as unknown as object,
        periodStart,
        periodEnd,
        issuedAt: sendNow ? now : null,
        dueAt,
        paymentInstructions:
          input.paymentInstructions ?? process.env.PLATFORM_PAYMENT_INSTRUCTIONS ?? null,
        notes: input.notes ?? null,
        createdByUserId: createdByUserId ?? null,
      },
    });
  });
}

/** Issue a DRAFT invoice to the customer (DRAFT → SENT). */
export async function sendInvoice(invoiceId: string): Promise<Invoice> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "DRAFT") return invoice; // already issued
  return db.invoice.update({
    where: { id: invoiceId },
    data: { status: "SENT", issuedAt: invoice.issuedAt ?? new Date() },
  });
}

/**
 * Confirm payment for an invoice and ACTIVATE the org's plan.
 *
 * Idempotent: paying an already-PAID invoice is a no-op. Refuses VOID invoices.
 * Runs the invoice update + Subscription upsert + audit row in one transaction,
 * then applies the tier's quota limits to the org (idempotent, single source of
 * truth in applyPlanToOrg).
 */
export async function markInvoicePaid(
  invoiceId: string,
  opts: { paidByUserId?: string; paymentReference?: string } = {}
): Promise<Invoice> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID") return invoice; // idempotent
  if (invoice.status === "VOID") {
    throw new Error("Cannot mark a void invoice as paid");
  }

  const now = new Date();
  const tier = invoice.planTier;
  const cycle = (invoice.billingCycle === "annual" ? "annual" : "monthly") as BillingCycle;
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + cycleDays(cycle) * MS_PER_DAY);

  const updated = await db.$transaction(async (tx) => {
    const inv = await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "PAID",
        paidAt: now,
        paidByUserId: opts.paidByUserId ?? null,
        paymentReference: opts.paymentReference ?? invoice.paymentReference,
      },
    });

    // Bring the org's Subscription into the active/paid state. Mirrors the
    // fields syncSubscription() writes for a Stripe sub, minus Stripe ids.
    await tx.subscription.upsert({
      where: { orgId: invoice.orgId },
      create: {
        orgId: invoice.orgId,
        planTier: tier,
        seats: PLAN_LIMITS[tier].seats,
        billingCycle: cycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: "active",
        isTrial: false,
      },
      update: {
        planTier: tier,
        seats: PLAN_LIMITS[tier].seats,
        billingCycle: cycle,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        status: "active",
        isTrial: false,
        trialEndsAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        orgId: invoice.orgId,
        action: "invoice.paid",
        resourceType: "invoice",
        resourceId: invoice.id,
        newValues: {
          number: invoice.number,
          planTier: tier,
          billingCycle: cycle,
          amountDue: invoice.amountDue,
          currency: invoice.currency,
          paymentReference: opts.paymentReference ?? null,
        },
      },
    });

    return inv;
  });

  // Apply tier limits to the org (idempotent; single source of truth).
  await applyPlanToOrg(invoice.orgId, tier);

  return updated;
}

/** Cancel an unpaid invoice. Refuses to void an already-PAID invoice. */
export async function voidInvoice(invoiceId: string): Promise<Invoice> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status === "PAID") {
    throw new Error("Cannot void a paid invoice");
  }
  if (invoice.status === "VOID") return invoice;
  return db.invoice.update({
    where: { id: invoiceId },
    data: { status: "VOID", voidedAt: new Date() },
  });
}

/**
 * Customer-side signal that they've sent payment. Does NOT change the plan —
 * it only flags the invoice so the operator knows to confirm receipt. Only
 * applies to SENT/OVERDUE invoices.
 */
export async function reportPayment(
  invoiceId: string,
  orgId: string,
  reference?: string
): Promise<Invoice> {
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, orgId } });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
    return invoice; // nothing to report for draft/paid/void
  }
  return db.invoice.update({
    where: { id: invoiceId },
    data: {
      paymentReportedAt: new Date(),
      paymentReference: reference ?? invoice.paymentReference,
    },
  });
}

/** True for statuses the customer should see (everything except DRAFT/VOID). */
export function isCustomerVisible(status: InvoiceStatus): boolean {
  return status === "SENT" || status === "OVERDUE" || status === "PAID";
}
