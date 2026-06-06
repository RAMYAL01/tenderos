import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.thetenderos.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep the authenticated app + API + auth pages out of the index.
        disallow: [
          "/api/",
          "/dashboard",
          "/tenders",
          "/proposals",
          "/compliance",
          "/library",
          "/analytics",
          "/settings",
          "/sign-in",
          "/sign-up",
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
