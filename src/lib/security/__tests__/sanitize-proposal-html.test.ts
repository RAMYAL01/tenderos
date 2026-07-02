import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeProposalHtml } from "../sanitize-proposal-html";

test("strips <script> entirely (payload never survives)", () => {
  const out = sanitizeProposalHtml(`<p>Hi</p><script>alert(document.cookie)</script>`);
  assert.ok(!/script/i.test(out), out);
  assert.ok(!/alert/.test(out), out);
  assert.ok(out.includes("Hi"));
});

test("drops <img onerror=...> (tag discarded, no handler)", () => {
  const out = sanitizeProposalHtml(`<img src=x onerror="fetch('//evil')">`);
  assert.ok(!/onerror/i.test(out), out);
  assert.ok(!/<img/i.test(out), out);
});

test("removes inline event handlers but keeps the element", () => {
  const out = sanitizeProposalHtml(`<div onclick="steal()">click</div>`);
  assert.ok(!/onclick/i.test(out), out);
  assert.ok(out.includes("click"));
});

test("strips javascript: hrefs but keeps the link text", () => {
  const out = sanitizeProposalHtml(`<a href="javascript:alert(1)">x</a>`);
  assert.ok(!/javascript:/i.test(out), out);
  assert.ok(out.includes("x"));
});

test("preserves legitimate rich-text formatting (Tiptap output)", () => {
  const html = `<h2>Approach</h2><p><strong>Bold</strong> and <em>italic</em> and <a href="https://x.com">link</a></p><ul><li>one</li><li>two</li></ul>`;
  const out = sanitizeProposalHtml(html);
  assert.ok(out.includes("<h2>Approach</h2>"));
  assert.ok(out.includes("<strong>Bold</strong>"));
  assert.ok(out.includes("<em>italic</em>"));
  assert.ok(out.includes(`href="https://x.com"`));
  assert.ok(out.includes("<li>one</li>") && out.includes("<li>two</li>"));
});

test("keeps text-align but drops other inline styles", () => {
  const out = sanitizeProposalHtml(`<p style="text-align:center;color:red;position:fixed">T</p>`);
  assert.ok(/text-align:\s*center/i.test(out), out);
  assert.ok(!/color/i.test(out), out);
  assert.ok(!/position/i.test(out), out);
});

test("forces rel=noopener on target=_blank links", () => {
  const out = sanitizeProposalHtml(`<a href="https://x.com" target="_blank">x</a>`);
  assert.ok(/rel="noopener noreferrer"/.test(out), out);
});

test("null / undefined / empty → empty string", () => {
  assert.equal(sanitizeProposalHtml(null), "");
  assert.equal(sanitizeProposalHtml(undefined), "");
  assert.equal(sanitizeProposalHtml(""), "");
});
