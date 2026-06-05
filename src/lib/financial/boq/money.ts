/**
 * Precision-safe money engine.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * IEEE-754 floating point silently corrupts currency:
 *   0.1 + 0.2 === 0.30000000000000004
 *   1.005 * 100 === 100.49999999999999   (so naive round-to-cents under-rounds)
 *   12.3 * 4575 in float drifts at scale.
 *
 * This module performs ALL arithmetic in INTEGER minor units using BigInt, so
 * results are EXACT at any magnitude with zero floating-point drift. Floats
 * appear only at two boundaries:
 *   - input parse: numbers are stringified and parsed digit-by-digit (never
 *     multiplied as floats),
 *   - display: minor units are formatted to a decimal string at the very end.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BPS_DENOM = 10000n; // basis-points denominator (100% = 10000 bps)

/** Quantity is scaled to this many decimal places before integer math. */
export const QTY_DECIMALS = 4;
const QTY_SCALE = 10n ** BigInt(QTY_DECIMALS);

/**
 * Half-up rounding division for BigInt: returns round(numerator / denominator).
 * "Half away from zero" — the standard rounding mode for currency.
 */
export function roundedDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("roundedDiv: division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = n / d;
  const remainder = n % d;
  const rounded = remainder * 2n >= d ? q + 1n : q; // >= .5 rounds up
  return negative ? -rounded : rounded;
}

/**
 * Expand a JS number to a plain decimal string, handling scientific notation
 * (e.g. 1.23e-7, 5e+21) so it can be parsed digit-by-digit without float error.
 */
function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Not a finite number: ${n}`);
  const str = String(n);
  if (!/e/i.test(str)) return str;

  const negative = n < 0;
  const [mantissa, expPart] = str.toLowerCase().replace("-", "").split("e");
  const exp = parseInt(expPart, 10);
  const dot = mantissa.indexOf(".");
  const digits = mantissa.replace(".", "");
  const intLen = dot === -1 ? mantissa.length : dot;
  const pointPos = intLen + exp;

  let out: string;
  if (pointPos <= 0) {
    out = "0." + "0".repeat(-pointPos) + digits;
  } else if (pointPos >= digits.length) {
    out = digits + "0".repeat(pointPos - digits.length);
  } else {
    out = digits.slice(0, pointPos) + "." + digits.slice(pointPos);
  }
  return (negative ? "-" : "") + out;
}

/**
 * Parse a decimal amount (number or numeric string) into integer minor units
 * with `decimals` fractional digits, using STRING math (no float multiply) and
 * half-up rounding.
 *   decimalToMinor("45.75", 2)  => 4575n
 *   decimalToMinor("45.755", 2) => 4576n   (half-up)
 *   decimalToMinor(12.5, 2)     => 1250n
 */
export function decimalToMinor(value: number | string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`decimalToMinor: decimals must be a non-negative integer (got ${decimals})`);
  }
  let s = (typeof value === "number" ? numberToPlainString(value) : String(value)).trim();

  let sign = 1n;
  if (s.startsWith("-")) {
    sign = -1n;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") {
    throw new Error(`decimalToMinor: not a valid decimal number ("${value}")`);
  }

  const [intPartRaw = "", fracPartRaw = ""] = s.split(".");
  const intPart = intPartRaw === "" ? "0" : intPartRaw;

  // keep `decimals` fractional digits + 1 guard digit for half-up rounding
  const fracPadded = (fracPartRaw + "0".repeat(decimals + 1)).slice(0, decimals + 1);
  const guardDigit = fracPadded.charAt(decimals);
  const fracKept = fracPadded.slice(0, decimals);

  let minor = BigInt(intPart + fracKept); // concatenation builds the scaled integer
  if (Number(guardDigit) >= 5) minor += 1n; // half-up
  return sign * minor;
}

/** Quantity (decimal) → scaled BigInt integer with QTY_DECIMALS places. */
export function scaleQuantity(value: number | string): bigint {
  return decimalToMinor(value, QTY_DECIMALS);
}

/**
 * direct cost (minor) = quantity × unit_cost.
 * `qtyScaled` is scaled by QTY_SCALE; `unitMinor` is already in minor units.
 * Integer multiply (BigInt — exact) then half-up divide back down the qty scale.
 */
export function multiplyQuantityByUnitCost(qtyScaled: bigint, unitMinor: bigint): bigint {
  return roundedDiv(qtyScaled * unitMinor, QTY_SCALE);
}

/** Percentage (e.g. 12.5) → basis points BigInt (1250). Half-up to integer bps. */
export function pctToBasisPoints(pct: number | string): bigint {
  // pct * 100 == decimalToMinor(pct, 2): 12.5 -> 1250 bps
  return decimalToMinor(pct, 2);
}

/** amountMinor × bps / 10000, half-up → minor units. */
export function applyBasisPoints(amountMinor: bigint, bps: bigint): bigint {
  return roundedDiv(amountMinor * bps, BPS_DENOM);
}

/** Convert minor units (BigInt) → JS number, guarding the 2^53 safe-integer boundary. */
export function minorToNumber(minor: bigint): number {
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Monetary value exceeds JS safe-integer range: ${minor.toString()} minor units`);
  }
  return Number(minor);
}

/** Minor units → display decimal number (for presentation only; never recompute with it). */
export function minorToDecimalNumber(minor: bigint, decimals: number): number {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const scale = 10n ** BigInt(decimals);
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, "0");
  const str = `${negative ? "-" : ""}${whole.toString()}${decimals > 0 ? "." + frac : ""}`;
  return Number(str);
}

/** Format minor units as a localized currency string, e.g. "SAR 1,234.56". */
export function formatMoney(minor: bigint, currency: string, decimals = 2): string {
  const value = minorToDecimalNumber(minor, decimals);
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}
