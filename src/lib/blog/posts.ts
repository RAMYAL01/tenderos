import type { Post, PostMeta } from "./types";
import {
  meta as whyLlmsMeta,
  Body as WhyLlmsBody,
} from "@/components/blog/posts/why-llms-cannot-price-a-boq";
import {
  meta as bilingualMeta,
  Body as BilingualBody,
} from "@/components/blog/posts/bilingual-tender-stack";
import {
  meta as zeroTrustMeta,
  Body as ZeroTrustBody,
} from "@/components/blog/posts/zero-trust-tenant-isolation";
import {
  meta as ocrMeta,
  Body as OcrBody,
} from "@/components/blog/posts/ocr-scanned-bilingual-tenders";

export const POSTS: Post[] = [
  { meta: whyLlmsMeta, Body: WhyLlmsBody },
  { meta: bilingualMeta, Body: BilingualBody },
  { meta: zeroTrustMeta, Body: ZeroTrustBody },
  { meta: ocrMeta, Body: OcrBody },
];

export function allPostsSorted(): Post[] {
  return [...POSTS].sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | undefined {
  return POSTS.find((p) => p.meta.slug === slug);
}

export function allPostMeta(): PostMeta[] {
  return allPostsSorted().map((p) => p.meta);
}
