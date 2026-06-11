import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * ISOLATION GUARD (audit finding M1).
 *
 * The Discovery catalog (Opportunity / OpportunitySource) is GLOBAL — shared
 * across every tenant. Its only sanctioned writer is src/lib/discovery/ingest.ts.
 * If any other source file writes it (create/update/upsert/delete/createMany/...),
 * a tenant-derived value could leak into the shared catalog and surface for every
 * other tenant. This test makes that rule executable: it greps the whole src tree
 * and fails the build if a write to the global tables appears anywhere else.
 *
 * Reads (findMany/findUnique/count) are allowed everywhere — only WRITES are banned.
 */

const SRC = join(__dirname, "..", "..", ".."); // -> tenderos/src
const ALLOWED = ["lib/discovery/ingest.ts"]; // the one sanctioned writer
const WRITE_OPS = "(create|createMany|update|updateMany|upsert|delete|deleteMany)";
const PATTERN = new RegExp(`db\\.(opportunity|opportunitySource)\\.${WRITE_OPS}\\b`);
// tx.opportunity.* inside transactions too:
const TX_PATTERN = new RegExp(`\\.(opportunity|opportunitySource)\\.${WRITE_OPS}\\b`);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__") continue;
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

test("only ingest.ts writes the global Opportunity catalog (M1)", () => {
  const offenders: string[] = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file).replace(/\\/g, "/");
    if (ALLOWED.includes(rel)) continue;
    const text = readFileSync(file, "utf8");
    if (PATTERN.test(text) || TX_PATTERN.test(text)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Global catalog written outside ingest.ts:\n  ${offenders.join("\n  ")}\nMove the write into src/lib/discovery/ingest.ts.`
  );
});
