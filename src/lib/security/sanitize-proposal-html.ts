import sanitizeHtml from "sanitize-html";

/**
 * Sanitize proposal-section HTML before it is stored OR rendered via
 * `dangerouslySetInnerHTML`.
 *
 * Closes the stored-XSS sink in the proposal preview (white-box finding #1):
 * proposal `contentEn` / `contentAr` are user-editable (Tiptap) and AI-generated,
 * and the print preview injects them as raw HTML. The app CSP allows
 * `script-src 'unsafe-inline'` (required by Clerk/Tiptap), so it does NOT backstop
 * injected markup — this sanitizer is the actual defense.
 *
 * Allowlist = exactly the tags Tiptap StarterKit (+ TextAlign) can produce, so
 * legitimate formatting is preserved while <script>, event-handler attributes, and
 * javascript:/data: URLs are stripped. Server-side only (pure Node, no DOM).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "del", "mark", "sub", "sup",
    "ul", "ol", "li",
    "blockquote", "pre", "code", "hr",
    "a",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    "*": ["style"],
  },
  // Only text-align survives — no arbitrary CSS (blocks style-based tricks).
  allowedStyles: {
    "*": { "text-align": [/^(left|right|center|justify)$/] },
  },
  // No javascript: / data: — links can only point at safe schemes.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  // Drop disallowed tags (incl. <script>, <img>, <iframe>) and their contents-as-markup.
  disallowedTagsMode: "discard",
  transformTags: {
    // Any link opening a new tab gets rel="noopener noreferrer" (tab-nabbing).
    a: (tagName, attribs) => {
      const attrs = { ...attribs };
      if (attrs.target === "_blank") attrs.rel = "noopener noreferrer";
      return { tagName, attribs: attrs };
    },
  },
};

/** Sanitize an HTML string. Returns "" for null/undefined/empty. */
export function sanitizeProposalHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
