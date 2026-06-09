import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata = {
  title: "Refund Policy",
  description:
    "How free trials, cancellations, and refunds work for TenderOS subscriptions — clear, fair terms for monthly and annual plans.",
};

const TOC = [
  { id: "summary", label: "1. Summary" },
  { id: "trial", label: "2. Free Trial" },
  { id: "monthly", label: "3. Monthly Plans" },
  { id: "annual", label: "4. Annual Plans" },
  { id: "guarantee", label: "5. 14-Day Guarantee" },
  { id: "eligible", label: "6. When We Do Refund" },
  { id: "not-eligible", label: "7. When We Don't" },
  { id: "enterprise", label: "8. Enterprise" },
  { id: "how", label: "9. How to Request" },
  { id: "processing", label: "10. Processing & Timing" },
  { id: "changes", label: "11. Changes" },
  { id: "contact", label: "12. Contact" },
];

export default function RefundPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Refund Policy"
      intro="We want you to evaluate TenderOS risk-free. This policy explains the free trial, how cancellations work, and the limited circumstances in which we issue refunds. It forms part of our Terms of Service."
      updated="9 June 2026"
      toc={TOC}
    >
      <h2 id="summary">1. Summary</h2>
      <ul>
        <li>Every plan starts with a <strong>14-day free trial</strong> — no charge if you cancel before it ends.</li>
        <li>You can <strong>cancel anytime</strong>; your plan stays active until the end of the paid period.</li>
        <li>
          <strong>Monthly</strong> fees are non-refundable for the current period. <strong>Annual</strong>{" "}
          plans include a <strong>14-day money-back guarantee</strong> on first purchase.
        </li>
        <li>We always refund duplicate charges and genuine billing errors.</li>
      </ul>

      <h2 id="trial">2. Free Trial</h2>
      <p>
        We offer a <strong>14-day free trial</strong> so you can evaluate TenderOS before paying. You
        will not be charged during the trial. If you cancel before the trial ends, you owe nothing.
        Unless you cancel, your subscription begins automatically at the end of the trial and your
        selected plan is billed. We may modify or end trial offers at any time.
      </p>

      <h2 id="monthly">3. Monthly Subscriptions</h2>
      <p>
        Monthly plans are billed in advance for each one-month period. They are{" "}
        <strong>non-refundable</strong>, including for partial months or unused seats, AI credits, or
        features. When you cancel, your subscription remains active until the end of the current paid
        month and then does not renew. We do not provide pro-rated refunds for mid-cycle cancellations
        or downgrades.
      </p>

      <h2 id="annual">4. Annual Subscriptions</h2>
      <p>
        Annual plans are billed in advance for a twelve-month term at a discount. They are covered by
        the 14-day money-back guarantee below. After that window, annual fees are non-refundable for the
        remainder of the term, and cancelling stops the next annual renewal rather than refunding the
        current term.
      </p>

      <h2 id="guarantee">5. 14-Day Money-Back Guarantee (Annual Plans)</h2>
      <p>
        If you purchase an annual plan for the <strong>first time</strong> and are not satisfied, request
        a refund within <strong>14 days</strong> of the initial charge and we will refund that charge in
        full. The guarantee applies once per organization and does not apply to renewals, upgrades, or
        reactivations.
      </p>

      <h2 id="eligible">6. When We Do Issue Refunds</h2>
      <ul>
        <li><strong>Duplicate or accidental charges</strong> caused by a payment or system error;</li>
        <li><strong>Incorrect billing</strong> (e.g. charged the wrong plan or after a valid, timely cancellation);</li>
        <li>
          <strong>Extended unavailability:</strong> a verified, prolonged outage that materially prevented
          use and was caused by us;
        </li>
        <li>Where a refund is <strong>required by applicable consumer law</strong> or by our merchant-of-record provider.</li>
      </ul>

      <h2 id="not-eligible">7. When Refunds Are Not Available</h2>
      <ul>
        <li>change of mind after the applicable trial or 14-day annual window;</li>
        <li>partial use of a billing period, or unused seats, credits, or storage;</li>
        <li>failure to cancel before a renewal date;</li>
        <li>
          suspension or termination of your account for breach of our{" "}
          <a href="/terms">Terms of Service</a> or acceptable-use rules;
        </li>
        <li>
          dissatisfaction with AI Output quality where the Service otherwise operated as intended —
          remember that AI output is a draft aid you are responsible for reviewing;
        </li>
        <li>outcomes outside our control, such as a bid not being awarded.</li>
      </ul>

      <h2 id="enterprise">8. Enterprise &amp; Self-Hosted Agreements</h2>
      <p>
        Enterprise and self-hosted subscriptions are governed by the refund and termination terms of
        their separately signed order form or master agreement, which take precedence over this policy
        where they conflict.
      </p>

      <h2 id="how">9. How to Request a Refund</h2>
      <p>
        Email <a href="mailto:support@thetenderos.com">support@thetenderos.com</a> from the workspace
        Owner or Admin account with:
      </p>
      <ol>
        <li>your organization / workspace name;</li>
        <li>the email on the account and the approximate charge date;</li>
        <li>the reason for the request and any relevant details.</li>
      </ol>
      <p>
        You can stop future billing yourself at any time from <strong>Billing settings</strong> in your
        workspace. Cancelling there prevents renewal but does not by itself trigger a refund of a charge
        already made.
      </p>

      <h2 id="processing">10. Processing &amp; Timing</h2>
      <p>
        Approved refunds are issued to the original payment method through our payment provider (Stripe or
        Lemon Squeezy). Once approved, refunds are typically initiated within{" "}
        <strong>5&ndash;10 business days</strong>; the time for funds to appear depends on your bank or
        card issuer. Refunds are made in the original currency; we are not responsible for exchange-rate
        differences or bank fees.
      </p>

      <h2 id="changes">11. Changes to this Policy</h2>
      <p>
        We may update this Refund Policy from time to time. The version in effect at the time of your
        purchase applies to that purchase. We will post updates here with a new &ldquo;Last updated&rdquo;
        date.
      </p>

      <h2 id="contact">12. Contact</h2>
      <p>
        Billing or refund questions? Email{" "}
        <a href="mailto:support@thetenderos.com">support@thetenderos.com</a> and we&rsquo;ll be glad to
        help.
      </p>
    </LegalShell>
  );
}
