import type { ContentLanguage } from "@prisma/client";

/** Subset of GazetteSource fields an adapter needs (mirrors the discovery AdapterSource). */
export interface GazetteAdapterSource {
  id: string;
  slug: string;
  baseUrl: string | null;
  country: string | null;
  defaultLanguage: ContentLanguage;
}

/** A normalized public award notice — the gazette-side input to the benchmark pool. */
export interface NormalizedAward {
  externalId: string; // stable id within the source (e.g. "ocid:awardId")
  buyerName: string | null;
  winnerName: string | null;
  awardedValue: number | null; // major units
  currency: string | null;
  sector: string | null;
  country: string | null; // ISO-2
  awardedAt: Date | null;
  bidderCount: number | null;
  sourceUrl: string | null;
}

export type GazetteAdapter = (source: GazetteAdapterSource) => Promise<NormalizedAward[]>;
