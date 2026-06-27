import type { ValueBand } from "@prisma/client";

/**
 * Bucket a money amount (integer minor units) into a coarse value band for
 * k-anonymized benchmark grouping. Banded on the raw amount; the benchmark read
 * groups by {sector, country, valueBand} and reports the dominant currency, so
 * currencies are not silently mixed.
 */
export function toValueBand(valueMinor: bigint | null | undefined): ValueBand {
  if (valueMinor == null) return "UNKNOWN";
  const major = Number(valueMinor) / 100;
  if (major < 1_000_000) return "UNDER_1M";
  if (major < 5_000_000) return "FROM_1M_5M";
  if (major < 25_000_000) return "FROM_5M_25M";
  if (major < 100_000_000) return "FROM_25M_100M";
  return "OVER_100M";
}

export const VALUE_BAND_LABELS: Record<ValueBand, string> = {
  UNDER_1M: "Under 1M",
  FROM_1M_5M: "1M – 5M",
  FROM_5M_25M: "5M – 25M",
  FROM_25M_100M: "25M – 100M",
  OVER_100M: "Over 100M",
  UNKNOWN: "Unknown",
};
