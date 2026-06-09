import { LegalShell } from "@/components/marketing/legal-shell";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How TenderOS collects, uses, processes, and protects personal data and the tender documents you entrust to the platform.",
};

const TOC = [
  { id: "overview", label: "1. Overview" },
  { id: "roles", label: "2. Controller & Processor" },
  { id: "data-we-collect", label: "3. Data We Collect" },
  { id: "how-we-use", label: "4. How We Use Data" },
  { id: "ai-processing", label: "5. AI Processing" },
  { id: "legal-bases", label: "6. Legal Bases" },
  { id: "sharing", label: "7. Sharing & Sub-Processors" },
  { id: "transfers", label: "8. International Transfers" },
  { id: "retention", label: "9. Retention" },
  { id: "security", label: "10. Security" },
  { id: "rights", label: "11. Your Rights" },
  { id: "self-hosted", label: "12. Self-Hosted Edition" },
  { id: "children", label: "13. Children" },
  { id: "changes", label: "14. Changes" },
  { id: "contact", label: "15. Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      title="Privacy Policy"
      intro="Procurement data is sensitive. This policy explains what we collect, why, who processes it, and the controls you have — for both personal data and the tender documents you upload."
      updated="9 June 2026"
      toc={TOC}
    >
      <h2 id="overview">1. Overview</h2>
      <p>
        This Privacy Policy describes how TenderOS (<strong>&ldquo;we&rdquo;</strong>,{" "}
        <strong>&ldquo;us&rdquo;</strong>) handles information in connection with the TenderOS platform,
        websites, and APIs (the <strong>&ldquo;Service&rdquo;</strong>). It applies to visitors, to the
        organizations that subscribe (<strong>&ldquo;Customers&rdquo;</strong>), and to the members
        those Customers invite into a workspace.
      </p>

      <h2 id="roles">2. Controller and Processor Roles</h2>
      <ul>
        <li>
          For <strong>account and website data</strong> (registration, billing, support, marketing), we
          act as a <strong>data controller</strong>.
        </li>
        <li>
          For <strong>Customer Data</strong> you upload into your workspace (tender documents, BOQs,
          proposals, and any personal data contained in them), we act as a{" "}
          <strong>data processor</strong> on behalf of the Customer, who is the controller. We process
          that data only on the Customer&rsquo;s instructions and to provide the Service.
        </li>
      </ul>

      <h2 id="data-we-collect">3. Data We Collect</h2>
      <h3>3.1 Information you provide</h3>
      <ul>
        <li>
          <strong>Workspace &amp; profile:</strong> company name, organization type, country, employee
          band, website, and member names, work emails, and roles.
        </li>
        <li>
          <strong>Billing:</strong> plan, subscription status, and billing identifiers. Card details are
          collected and stored by our payment providers — <strong>we do not store full card numbers</strong>.
        </li>
        <li>
          <strong>Support &amp; communications:</strong> messages, requests, and feedback you send us.
        </li>
        <li>
          <strong>Customer Data:</strong> the documents and content you and your members upload or
          generate, which may contain personal data (e.g. names and contact details of staff or
          signatories within a tender).
        </li>
      </ul>
      <h3>3.2 Information collected automatically</h3>
      <ul>
        <li>
          <strong>Usage &amp; device data:</strong> log data, IP address, browser/device type, pages
          viewed, and feature interactions, used for security, diagnostics, and product improvement.
        </li>
        <li>
          <strong>Cookies:</strong> strictly necessary cookies for authentication and security, and —
          only with consent where required — limited analytics. You can control non-essential cookies
          via the consent banner and your browser.
        </li>
      </ul>

      <h2 id="how-we-use">4. How We Use Data</h2>
      <ul>
        <li>provide, operate, secure, and improve the Service;</li>
        <li>authenticate users and enforce workspace roles and tenant isolation;</li>
        <li>process subscriptions, payments, trials, and renewals;</li>
        <li>provide support and respond to your requests;</li>
        <li>monitor for abuse, fraud, and security threats, and meet legal obligations;</li>
        <li>
          send service and transactional messages, and — where permitted — relevant product updates you
          can opt out of.
        </li>
      </ul>

      <h2 id="ai-processing">5. AI Processing of Your Documents</h2>
      <p>
        To deliver core features, content from your workspace is sent to AI sub-processors for
        optical character recognition, requirement extraction, embeddings, and drafting. Specifically:
      </p>
      <ul>
        <li>
          Uploaded documents may be processed by OCR and large-language-model providers to extract and
          generate Output;
        </li>
        <li>
          Document text is converted into vector embeddings to power grounded retrieval, stored against
          your organization with strict tenant isolation so it is never searchable by another customer;
        </li>
        <li>
          <strong>We do not sell your data, and we do not allow your Customer Data to be used to train
          third-party foundation models.</strong> Our AI providers process your content only to return
          results to us under their enterprise/API terms;
        </li>
        <li>
          Any product-improvement or model fine-tuning we perform uses only{" "}
          <strong>de-identified and aggregated</strong> data — with organization identifiers hashed and
          prices and personal data redacted — and only where permitted.
        </li>
      </ul>

      <h2 id="legal-bases">6. Legal Bases (where GDPR / similar laws apply)</h2>
      <ul>
        <li><strong>Contract:</strong> to provide the Service you and your organization signed up for;</li>
        <li><strong>Legitimate interests:</strong> to secure, support, and improve the Service;</li>
        <li><strong>Consent:</strong> for non-essential cookies and optional marketing;</li>
        <li><strong>Legal obligation:</strong> for tax, accounting, and compliance.</li>
      </ul>

      <h2 id="sharing">7. Sharing &amp; Sub-Processors</h2>
      <p>
        We share data only with service providers that help us run the Service, under contracts that
        require appropriate confidentiality and security. Core sub-processors include:
      </p>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Vercel</td><td>Application hosting &amp; delivery</td></tr>
          <tr><td>Neon</td><td>Managed PostgreSQL database (incl. vector storage)</td></tr>
          <tr><td>Clerk</td><td>Authentication &amp; organization management</td></tr>
          <tr><td>Anthropic</td><td>Large-language-model processing (extraction, drafting, OCR)</td></tr>
          <tr><td>OpenAI</td><td>Text embeddings for retrieval</td></tr>
          <tr><td>Stripe</td><td>Payment processing</td></tr>
          <tr><td>Lemon Squeezy</td><td>Merchant of record &amp; payment processing (selected regions)</td></tr>
        </tbody>
      </table>
      <p>
        We may also disclose data if required by law, to enforce our agreements, to protect rights and
        safety, or in connection with a merger or acquisition (with notice where required). We do not
        sell personal data.
      </p>

      <h2 id="transfers">8. International Transfers</h2>
      <p>
        We and our sub-processors may process data in countries other than yours, including outside the
        MENA region. Where required, we rely on appropriate safeguards (such as standard contractual
        clauses) for cross-border transfers. Customers with data-residency requirements should consider
        the self-hosted edition described below.
      </p>

      <h2 id="retention">9. Data Retention</h2>
      <p>
        We retain account data for as long as your workspace is active and as needed to provide the
        Service. Customer Data is retained until you delete it or your workspace is closed; after
        termination we delete or anonymize Customer Data within a reasonable period, except where we
        must retain records to meet legal, tax, or security obligations. You can delete documents and
        export data at any time while your subscription is active.
      </p>

      <h2 id="security">10. Security</h2>
      <ul>
        <li>encryption of data in transit and at rest with our infrastructure providers;</li>
        <li>
          strict <strong>tenant isolation</strong> — every record is scoped to its organization, and
          retrieval is filtered by organization before ranking so one customer can never access
          another&rsquo;s data;
        </li>
        <li>role-based access control across the seven workspace roles, and least-privilege internal access;</li>
        <li>audit logging, monitoring, and secure software-development practices.</li>
      </ul>
      <p>
        No system is perfectly secure, but we work to protect your data and will notify affected
        Customers of a personal-data breach as required by law.
      </p>

      <h2 id="rights">11. Your Rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, delete, restrict, or port
        your personal data, and to object to certain processing or withdraw consent. For{" "}
        <strong>account data</strong>, contact us at{" "}
        <a href="mailto:privacy@thetenderos.com">privacy@thetenderos.com</a>. For{" "}
        <strong>Customer Data</strong> held in a workspace, we act on the Customer&rsquo;s instructions —
        if you are a member, please contact your workspace Owner/Admin, or we will refer your request to
        them. You may also lodge a complaint with your local data-protection authority.
      </p>

      <h2 id="self-hosted">12. Self-Hosted / Air-Gapped Edition</h2>
      <p>
        Organizations with strict confidentiality or data-residency requirements can deploy the
        self-hosted edition entirely within their own infrastructure. In that configuration, AI runs on
        in-network models and <strong>no Customer Data is sent to external AI providers or to us</strong>;
        the Customer controls hosting, storage, identity, and retention.
      </p>

      <h2 id="children">13. Children</h2>
      <p>
        The Service is for business use and is not directed to individuals under 18. We do not knowingly
        collect personal data from children.
      </p>

      <h2 id="changes">14. Changes to this Policy</h2>
      <p>
        We may update this policy as the Service evolves or for legal reasons. We will post the updated
        version with a new &ldquo;Last updated&rdquo; date and, for material changes, provide reasonable
        notice. Continued use after changes take effect means you accept the updated policy.
      </p>

      <h2 id="contact">15. Contact Us</h2>
      <p>
        For privacy questions or to exercise your rights, contact{" "}
        <a href="mailto:privacy@thetenderos.com">privacy@thetenderos.com</a>. For a Data Processing
        Addendum or our current sub-processor list, contact{" "}
        <a href="mailto:legal@thetenderos.com">legal@thetenderos.com</a>.
      </p>
    </LegalShell>
  );
}
