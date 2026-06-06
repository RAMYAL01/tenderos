import type { MetadataRoute } from "next";
import { allCombos } from "@/lib/seo/programmatic-data";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/solutions/boq-pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/solutions/tender-extraction`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const programmatic: MetadataRoute.Sitemap = allCombos().map((c) => ({
    url: `${SITE}/tender-software/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticPages, ...programmatic];
}
