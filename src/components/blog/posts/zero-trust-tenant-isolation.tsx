import type { PostMeta } from "@/lib/blog/types";
import { Lead, H2, P, UL, Callout, Code } from "@/components/blog/article-kit";

export const meta: PostMeta = {
  slug: "zero-trust-tenant-isolation-bid-data",
  title: "Zero-Trust Tenant Isolation for Bid Data: Why a WHERE Clause Is Not a Security Model",
  description:
    "Your rate book and win/loss history are your competitive edge. If a multi-tenant SaaS relies on developers remembering to filter by company, one missed clause leaks it. Here is the database-extension architecture that makes cross-tenant leakage structurally impossible.",
  excerpt:
    "One forgotten WHERE clause leaks your rate book to a competitor. The client-extension architecture that makes cross-tenant leakage impossible.",
  category: "Security",
  date: "2026-05-20",
  readingMinutes: 6,
  tags: ["Security", "Multi-Tenancy", "Zero Trust"],
};

export function Body() {
  return (
    <>
      <Lead>
        For a contractor, the most sensitive data in the business is not personal — it is commercial. Your unit
        rates, your overhead assumptions, your win/loss history: that is the formula competitors would pay to see.
        So the question a procurement director should ask any bidding SaaS is blunt: <em>what stops another tenant
        on this platform from ever seeing my numbers?</em> &ldquo;We filter by company ID&rdquo; is not an
        acceptable answer.
      </Lead>

      <H2>Why &ldquo;just add a WHERE clause&rdquo; fails</H2>
      <P>
        In naive multi-tenancy, isolation depends on every developer remembering to append{" "}
        <code>WHERE org_id = ?</code> to every query, forever. That is not a security model — it is a hope. A
        single forgotten clause in one new feature, one analytics endpoint, one background job, and one tenant&apos;s
        data crosses to another. The failure is silent, and you discover it the worst possible way.
      </P>

      <Callout variant="warning" title="The threat is structural, so the defense must be too.">
        You cannot solve a &ldquo;someone might forget&rdquo; problem with discipline. You solve it by making the
        unsafe thing impossible to express.
      </Callout>

      <H2>Defense 1 — Isolation in the data layer, not the route</H2>
      <P>
        TenderOS enforces tenancy with a Prisma client extension that intercepts <em>every</em> query before it
        reaches Postgres. The list of tenant-scoped models is derived from the schema itself, so a query against any
        of them is automatically constrained to the caller&apos;s organization — and a write that tries to set a
        different org id is rejected. Application code physically cannot issue an unscoped query against tenant data;
        the safe path is the only path.
      </P>
      <Code>{`// Every call goes through a tenant-bound client:
const db = getTenantDb(orgId);
await db.rateCatalogueItem.findMany();   // org filter injected, always
// There is no API surface to query another org's rows.`}</Code>

      <H2>Defense 2 — Tenant-bound vector search</H2>
      <P>
        Semantic search over past proposals is where naive RAG leaks. If you embed everyone&apos;s content into one
        index and filter results <em>after</em> ranking, a competitor&apos;s winning answer can surface in your
        result set. We bind the organization id into the SQL <code>WHERE</code> clause of the pgvector query{" "}
        <strong>before</strong> ranking, so the nearest-neighbor search only ever ranks rows the tenant owns. Other
        tenants&apos; vectors are not de-prioritized — they are never candidates.
      </P>

      <H2>Defense 3 — Least-privilege context for the AI</H2>
      <P>
        Even the model is on a need-to-know basis. Before any tenant context is sent to the LLM, financial totals
        are redacted and the real tenant identifier is replaced with an opaque token, so sensitive figures and tenant
        identity never sit in a third-party prompt. The AI gets exactly enough to do its job and nothing it could
        leak.
      </P>

      <H2>Defense 4 — An immutable audit trail</H2>
      <P>
        Every read and write to tenant data is recorded out-of-band — who, what, which org, when. The same client
        extension that enforces isolation also emits the audit event, so logging is not something a feature can
        forget either. If a question of access ever arises, there is a record, not a guess.
      </P>

      <UL>
        <li><strong>Data-layer enforcement</strong> — isolation lives below application code, not inside it.</li>
        <li><strong>Pre-rank vector filtering</strong> — other tenants&apos; embeddings are never candidates.</li>
        <li><strong>Redacted, tokenized AI context</strong> — totals and identity never reach the model.</li>
        <li><strong>Automatic audit trail</strong> — every access is recorded by the same layer that guards it.</li>
      </UL>

      <P>
        Zero-trust here means the architecture assumes any individual query, feature, or developer could make a
        mistake — and removes the blast radius of that mistake by construction. Your rate book stays yours because
        the system is built so it cannot be otherwise.
      </P>
    </>
  );
}
