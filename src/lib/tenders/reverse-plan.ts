/**
 * Reverse-planned bid schedule (Wave 3, #7). Pure date math — given a submission
 * deadline, work BACKWARD to due dates for the standard capture stages, scaled to
 * the available lead time. Deterministic; no AI, no side effects.
 */

export interface PlannedMilestone {
  key: string;
  label: string;
  dueAt: Date;
  orderIndex: number;
}

/** Each stage should be DONE this fraction of the lead time before the deadline. */
const STAGES: { key: string; label: string; fractionBefore: number }[] = [
  { key: "go_no_go", label: "Bid / No-Bid decision", fractionBefore: 0.9 },
  { key: "requirements", label: "Requirements & compliance complete", fractionBefore: 0.7 },
  { key: "technical", label: "Technical draft complete", fractionBefore: 0.5 },
  { key: "pricing", label: "Pricing / financials complete", fractionBefore: 0.3 },
  { key: "review", label: "Internal review & sign-off", fractionBefore: 0.15 },
  { key: "qa", label: "Final QA & assembly", fractionBefore: 0.05 },
  { key: "submit", label: "Submit", fractionBefore: 0 },
];

/**
 * Build the reverse-planned schedule. Returns [] when the deadline is missing or
 * already passed (nothing to pace). Every due date is clamped into [now, deadline].
 */
export function reversePlan(deadline: Date | null | undefined, now: Date = new Date()): PlannedMilestone[] {
  if (!deadline) return [];
  const end = deadline.getTime();
  const start = now.getTime();
  const lead = end - start;
  if (lead <= 0) return [];

  return STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    dueAt: new Date(Math.min(end, Math.max(start, Math.round(end - s.fractionBefore * lead)))),
    orderIndex: i,
  }));
}
