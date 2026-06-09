import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms governing your use of TenderOS — the AI-powered, bilingual proposal-intelligence platform for government and enterprise contractors.",
};

const TOC = [
  { id: "agreement", label: "1. Agreement" },
  { id: "service", label: "2. The Service" },
  { id: "accounts", label: "3. Accounts & Workspaces" },
  { id: "plans", label: "4. Plans, Trials & Billing" },
  { id: "customer-data", label: "5. Your Data & Content" },
  { id: "ai", label: "6. AI Features & Output" },
  { id: "acceptable-use", label: "7. Acceptable Use" },
  { id: "ip", label: "8. Intellectual Property" },
  { id: "confidentiality", label: "9. Confidentiality" },
  { id: "third-party", label: "10. Third-Party Services" },
  { id: "warranties", label: "11. Disclaimers" },
  { id: "liability", label: "12. Limitation of Liability" },
  { id: "indemnity", label: "13. Indemnification" },
  { id: "term", label: "14. Term & Termination" },
  { id: "changes", label: "15. Changes to Terms" },
  { id: "law", label: "16. Governing Law" },
  { id: "contact", label: "17. Contact" },
];

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Terms of Service"
      intro="These Terms govern your access to and use of TenderOS. Please read them carefully — by using the Service you agree to be bound by them on behalf of your organization."
      updated="9 June 2026"
      toc={TOC}
    >
      <h2 id="agreement">1. Agreement to these Terms</h2>
      <p>
        These Terms of Service (the <strong>&ldquo;Terms&rdquo;</strong>) are a binding agreement
        between TenderOS (<strong>&ldquo;TenderOS&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>,{" "}
        <strong>&ldquo;us&rdquo;</strong>) and the organization you represent (the{" "}
        <strong>&ldquo;Customer&rdquo;</strong>, <strong>&ldquo;you&rdquo;</strong>). They cover the
        TenderOS web application, APIs, and related services (together, the{" "}
        <strong>&ldquo;Service&rdquo;</strong>).
      </p>
      <p>
        By creating a workspace, clicking &ldquo;I agree,&rdquo; or otherwise using the Service, you
        represent that you are authorized to bind your organization and that you accept these Terms.
        If you do not agree, do not use the Service. In TenderOS, the <strong>company is the
        customer</strong>; individual users act only as members of a company workspace.
      </p>

      <h2 id="service">2. The Service</h2>
      <p>
        TenderOS is an AI-assisted, bilingual (Arabic/English) proposal-intelligence platform for
        government and enterprise contractors. It helps bid teams ingest tender documents, extract
        requirements, build compliance matrices, price Bills of Quantities, and draft proposal
        content. We may add, change, or remove features over time to improve the Service.
      </p>
      <p>
        TenderOS is a productivity and decision-support tool. It does <strong>not</strong> provide
        legal, financial, procurement, or professional advice, and it does not guarantee that any
        bid will be compliant, accepted, or awarded. You remain solely responsible for reviewing,
        verifying, and approving every output before relying on or submitting it.
      </p>

      <h2 id="accounts">3. Accounts &amp; Workspaces</h2>
      <ul>
        <li>
          A <strong>workspace</strong> belongs to your organization. All data, content, subscriptions,
          and AI artifacts within it are owned and controlled at the organization level.
        </li>
        <li>
          The first user to create a workspace becomes its <strong>Owner</strong>. Owners and Admins
          may invite members, assign roles (Owner, Admin, Manager, and contributor/reviewer roles),
          and remove access.
        </li>
        <li>
          You are responsible for the confidentiality of your credentials and for all activity that
          occurs under your workspace, including the acts of your members and invitees.
        </li>
        <li>
          You must provide accurate registration information and keep it current. You must be at least
          18 years old and legally able to enter into this agreement.
        </li>
      </ul>

      <h2 id="plans">4. Plans, Free Trials &amp; Billing</h2>
      <h3>4.1 Subscription plans</h3>
      <p>
        The Service is offered on subscription plans (e.g. Starter, Professional, Business) and, for
        qualifying organizations, an Enterprise/self-hosted edition. Each plan includes defined limits
        such as seats, monthly proposals, AI credits, and storage. Current pricing and plan features
        are shown on our pricing page and may change with notice as described below.
      </p>
      <h3>4.2 Free trial</h3>
      <p>
        We may offer a <strong>14-day free trial</strong>. Unless you cancel before the trial ends,
        your subscription begins and the payment method on file (if any) is charged for the plan you
        selected. We may modify or withdraw trials at any time.
      </p>
      <h3>4.3 Fees, renewal &amp; payment processing</h3>
      <ul>
        <li>
          Subscriptions renew automatically for successive periods (monthly or annual) until cancelled.
          By subscribing you authorize recurring charges to your payment method.
        </li>
        <li>
          Payments are processed by our third-party payment and merchant-of-record providers (such as
          Stripe and Lemon Squeezy). Your use of payment processing is also subject to their terms.
        </li>
        <li>
          Fees are stated exclusive of taxes unless noted. You are responsible for applicable taxes,
          duties, and VAT, except taxes on our net income. Where a merchant-of-record collects tax, it
          will be added at checkout.
        </li>
        <li>
          Fees are non-refundable except as set out in our{" "}
          <a href="/refund">Refund Policy</a>, which forms part of these Terms.
        </li>
      </ul>
      <h3>4.4 Cancellation &amp; downgrades</h3>
      <p>
        You may cancel or downgrade at any time from your workspace billing settings. Cancellation
        stops future renewals; your plan remains active until the end of the current paid period.
        Downgrades may reduce limits and disable features that exceed the lower plan.
      </p>

      <h2 id="customer-data">5. Your Data &amp; Content</h2>
      <p>
        <strong>You own your data.</strong> All documents, tenders, BOQs, proposals, and other
        material you or your members upload or generate (<strong>&ldquo;Customer Data&rdquo;</strong>)
        remain your property. We claim no ownership of Customer Data.
      </p>
      <p>
        You grant TenderOS a limited, worldwide, non-exclusive licence to host, process, transmit, and
        display Customer Data solely to provide and support the Service for you — including passing
        relevant content to the AI sub-processors described in Section 10 and our{" "}
        <a href="/privacy">Privacy Policy</a>. We do not sell Customer Data, and we do not use your
        Customer Data to train third-party foundation models. Any internal model-improvement is
        performed only on de-identified, aggregated data and only where permitted by your plan and
        applicable law.
      </p>
      <p>
        You are responsible for the accuracy, legality, and rights to all Customer Data, and for
        ensuring you may lawfully upload it (including tender documents that may be subject to
        procurement confidentiality rules).
      </p>

      <h2 id="ai">6. AI Features &amp; Output</h2>
      <ul>
        <li>
          The Service uses artificial intelligence, including third-party large language models and
          optical character recognition, to extract, summarize, and generate content
          (<strong>&ldquo;Output&rdquo;</strong>).
        </li>
        <li>
          AI Output can be <strong>inaccurate, incomplete, or misleading</strong> (&ldquo;hallucinations&rdquo;),
          especially from low-quality scans or ambiguous source documents. Output is a draft aid, not a
          source of truth.
        </li>
        <li>
          You must independently review and verify all Output — particularly extracted requirements,
          quantities, pricing, and compliance determinations — before submission or reliance. Final
          pricing computations are produced by our deterministic calculation engine, but the inputs you
          confirm remain your responsibility.
        </li>
        <li>
          As between you and us, and to the extent permitted by law, you own the Output generated for
          your workspace, subject to the rights of underlying model providers and these Terms.
        </li>
      </ul>

      <h2 id="acceptable-use">7. Acceptable Use</h2>
      <p>You agree not to, and not to permit any member or third party to:</p>
      <ul>
        <li>use the Service to violate any law, regulation, sanctions regime, or procurement rule;</li>
        <li>upload content you have no right to use, or that infringes third-party rights;</li>
        <li>upload malware, or attempt to breach, probe, or disrupt the Service or its security;</li>
        <li>
          reverse engineer, scrape, resell, or build a competing product from the Service, except to
          the extent this restriction is prohibited by law;
        </li>
        <li>exceed, circumvent, or share access beyond your licensed seats and plan limits;</li>
        <li>
          use the Service to generate unlawful, fraudulent, deceptive, or knowingly false bid content;
        </li>
        <li>use the Service to develop or train a competing AI model or service.</li>
      </ul>
      <p>
        We may suspend access to protect the Service, other customers, or to comply with law, and will
        try to give you reasonable notice where practical.
      </p>

      <h2 id="ip">8. Intellectual Property</h2>
      <p>
        The Service, including its software, models integrations, design, and brand, is owned by
        TenderOS and its licensors and is protected by intellectual-property laws. We grant you a
        limited, non-exclusive, non-transferable, revocable right to use the Service during your
        subscription, solely for your internal business purposes. All rights not expressly granted are
        reserved. You may submit feedback, and you grant us a perpetual, royalty-free right to use it
        to improve the Service.
      </p>

      <h2 id="confidentiality">9. Confidentiality</h2>
      <p>
        Each party may access the other&rsquo;s confidential information. We treat your Customer Data
        and tender materials as your confidential information and will use them only to provide the
        Service. Each party will protect the other&rsquo;s confidential information with at least
        reasonable care and will not disclose it except to personnel and sub-processors who need it and
        are bound by confidentiality obligations, or as required by law.
      </p>

      <h2 id="third-party">10. Third-Party Services &amp; Sub-Processors</h2>
      <p>
        The Service relies on sub-processors for hosting, AI, authentication, and payments (for example
        Vercel, Neon, Anthropic, OpenAI, Clerk, Stripe, and Lemon Squeezy). These providers process
        data on our behalf under their own terms and security commitments, as further described in our{" "}
        <a href="/privacy">Privacy Policy</a>. Customers using the self-hosted / air-gapped edition can
        operate the Service entirely within their own infrastructure, in which case external AI
        sub-processors are not used.
      </p>

      <h2 id="warranties">11. Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available.&rdquo;</strong> To
        the fullest extent permitted by law, we disclaim all warranties, express or implied, including
        merchantability, fitness for a particular purpose, non-infringement, and any warranty that the
        Service or any Output will be accurate, uninterrupted, error-free, or that any bid prepared with
        the Service will be compliant, accepted, or awarded.
      </p>

      <h2 id="liability">12. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, neither party will be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for lost profits, lost revenue,
        lost or missed bids, lost contracts, or lost or corrupted data. Our total aggregate liability
        arising out of or relating to the Service will not exceed the amounts you paid to us for the
        Service in the <strong>twelve (12) months</strong> before the event giving rise to the claim.
      </p>

      <h2 id="indemnity">13. Indemnification</h2>
      <p>
        You will defend and indemnify TenderOS against third-party claims arising from your Customer
        Data, your use of the Service in breach of these Terms, or your violation of law or third-party
        rights, except to the extent caused by our breach of these Terms.
      </p>

      <h2 id="term">14. Term &amp; Termination</h2>
      <p>
        These Terms apply while you use the Service. Either party may terminate for material breach not
        cured within 30 days of notice. On termination, your right to use the Service ends. You may
        export your Customer Data before termination; after a reasonable retention window we will delete
        or anonymize Customer Data in accordance with our <a href="/privacy">Privacy Policy</a>, except
        where retention is required by law. Sections that by their nature should survive (including 5,
        8, 9, 11, 12, 13, and 16) survive termination.
      </p>

      <h2 id="changes">15. Changes to these Terms</h2>
      <p>
        We may update these Terms to reflect changes to the Service or for legal reasons. We will post
        the updated Terms with a new &ldquo;Last updated&rdquo; date and, for material changes, provide
        reasonable notice (for example by email or in-app). Continued use after changes take effect
        means you accept the updated Terms.
      </p>

      <h2 id="law">16. Governing Law &amp; Disputes</h2>
      <p>
        These Terms are governed by the laws of the Arab Republic of Egypt, without regard to its
        conflict-of-laws rules, and the parties submit to the exclusive jurisdiction of the competent
        courts located there, unless a separate written agreement (such as an enterprise order form)
        specifies otherwise. Nothing limits either party from seeking injunctive relief to protect its
        intellectual property or confidential information.
      </p>

      <h2 id="contact">17. Contact</h2>
      <p>
        Questions about these Terms? Contact us at{" "}
        <a href="mailto:legal@thetenderos.com">legal@thetenderos.com</a>. For an enterprise agreement,
        Data Processing Addendum, or security review, contact{" "}
        <a href="mailto:sales@thetenderos.com">sales@thetenderos.com</a>.
      </p>
    </LegalShell>
  );
}
