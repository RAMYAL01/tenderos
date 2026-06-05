/**
 * Typed errors for the BOQ pricing pipeline.
 *
 * FATAL errors (bad config, empty BOQ) are thrown as `BoqPricingError`.
 * NON-FATAL, per-line problems (missing rate, unit mismatch, bad quantity) are
 * NOT thrown — they are collected as `LineItemError[]` in the result so a single
 * bad row never aborts pricing of an entire Bill of Quantities.
 */

export type FatalBoqErrorCode = "EMPTY_BOQ" | "INVALID_CONFIG";

export class BoqPricingError extends Error {
  constructor(
    public readonly code: FatalBoqErrorCode,
    message: string
  ) {
    super(message);
    this.name = "BoqPricingError";
    Object.setPrototypeOf(this, BoqPricingError.prototype);
  }
}
