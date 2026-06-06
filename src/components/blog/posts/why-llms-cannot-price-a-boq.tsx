import type { PostMeta } from "@/lib/blog/types";
import { Lead, H2, P, UL, Callout, Code } from "@/components/blog/article-kit";

export const meta: PostMeta = {
  slug: "why-llms-cannot-price-a-boq",
  title: "Why LLMs Cannot Be Trusted to Price a BOQ — and the Deterministic Architecture That Fixes It",
  description:
    "Pricing is a financial-controls problem, not a text-generation one. Here is exactly how language models corrupt a Bill of Quantities — and the integer-exact engine that makes a hallucinated number structurally impossible.",
  excerpt:
    "Pricing is a financial-controls problem, not text generation. How LLMs corrupt a BOQ — and the deterministic engine that fixes it.",
  category: "Engineering",
  date: "2026-06-02",
  readingMinutes: 7,
  tags: ["Pricing", "Deterministic Math", "BOQ"],
};

export function Body() {
  return (
    <>
      <Lead>
        A bid manager once asked why TenderOS doesn&apos;t just &ldquo;let the AI price the BOQ.&rdquo; The
        honest answer is the single most important architectural decision we made: a language model is
        structurally incapable of producing a number you can defend in a commercial review. Pricing is a
        financial-controls problem, not a text-generation one — and the two require opposite tools.
      </Lead>

      <H2>Three ways a language model corrupts a price</H2>
      <UL>
        <li>
          <strong>Non-reproducibility.</strong> Ask the same model the same pricing question twice and you can
          get two different totals. A number you cannot reproduce is a number you cannot audit, and a bid you
          cannot audit is a bid you cannot stand behind.
        </li>
        <li>
          <strong>Fabricated rates.</strong> When a unit rate is missing, a model does what it is trained to do —
          it produces a plausible-looking value. In commercial bidding, a plausible-but-invented rate is
          indistinguishable from sabotage.
        </li>
        <li>
          <strong>Silent arithmetic drift.</strong> Even when a model &ldquo;does the math,&rdquo; the math runs on
          floating-point numbers — and floating point quietly corrupts currency.
        </li>
      </UL>

      <H2>The silent killer: floating-point currency math</H2>
      <P>
        This is the part most teams miss. The moment a monetary value touches IEEE-754 floating point — the
        default for numbers in virtually every language — currency breaks in ways that look fine until they
        don&apos;t:
      </P>
      <Code>{`0.1 + 0.2                     // => 0.30000000000000004
Math.round(1.005 * 100) / 100  // => 1.00  (should be 1.01)`}</Code>
      <P>
        A single line item rounds &ldquo;close enough.&rdquo; Across a 4,000-line BOQ with overhead, contingency,
        profit, and VAT applied on top, those sub-cent errors compound into a bottom line that is wrong by real
        money — and irreproducible to boot.
      </P>

      <H2>The fix: integer minor units, end to end</H2>
      <P>
        TenderOS performs <em>every</em> monetary calculation in integer minor units (halalas, fils, cents) using
        BigInt. There is no floating-point arithmetic anywhere in the money path, so results are exact at any
        magnitude with zero drift. The build-up is explicit and ordered:
      </P>
      <Code>{`direct   = round(qtyScaled * unitMinor / QTY_SCALE)   // qty x unit cost
overhead = round(direct * overheadBps / 10000)        // markup %
profit   = round((direct + overhead) * profitBps / 10000)
lineTotal = direct + overhead + profit                // exact integers`}</Code>
      <P>
        Decimal inputs are parsed digit-by-digit from strings (so <code>1.005</code> rounds half-up to
        <code> 1.01</code>, correctly), never multiplied as floats. Percentages become integer basis points.
        Floats appear only at the display boundary, after the math is already done.
      </P>

      <H2>The AI&apos;s job ends before the math begins</H2>
      <P>
        The model extracts <em>structure</em> — item codes, descriptions, quantities, units of measure. It never
        sets, infers, estimates, or rounds a price. Unit rates come exclusively from the company&apos;s own
        labor-rate and material-cost catalogue, synced from Excel or the ERP. The boundary is absolute: extraction
        is probabilistic; pricing is deterministic.
      </P>

      <Callout title="Same inputs, same output — always.">
        Because every figure is a pure arithmetic function of your quantities, your rates, and your
        overhead/contingency/profit/VAT assumptions, the same inputs always produce the same priced output. That
        is not a nice-to-have — for a commercial director, reproducibility <em>is</em> the product.
      </Callout>

      <H2>Why this is a moat, not a feature</H2>
      <P>
        Generic &ldquo;AI estimating&rdquo; tools are language models with a prompt. They will always carry the
        three failure modes above, because those failures are inherent to what a language model <em>is</em>. A
        deterministic engine driven by your own rate book is a different category of system — one built like a
        financial control, with the AI confined to the one thing it is genuinely good at: reading messy documents.
      </P>
    </>
  );
}
