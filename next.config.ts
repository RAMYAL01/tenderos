import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy
 * Strict but compatible with Clerk, Tiptap, Cloudflare R2 (file storage,
 * presigned browser upload/download), and PostHog (analytics). The legacy
 * *.amazonaws.com entries are kept harmlessly during/after the S3→R2 move.
 */
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://clerk.thetenderos.com https://challenges.cloudflare.com https://*.sentry.io https://us-assets.i.posthog.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: blob: https://img.clerk.com https://*.amazonaws.com https://*.cloudfront.net https://*.r2.cloudflarestorage.com;
  connect-src 'self' https://*.clerk.accounts.dev https://clerk.thetenderos.com https://challenges.cloudflare.com https://*.sentry.io wss://*.clerk.accounts.dev https://*.amazonaws.com https://*.r2.cloudflarestorage.com https://us.i.posthog.com https://us-assets.i.posthog.com ${isDev ? "ws://localhost:* http://localhost:*" : ""};
  frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`
  .replace(/\n/g, " ")
  .trim();

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  // Only set CSP in production (loosened in dev for hot reload etc.)
  ...(isDev
    ? []
    : [
        {
          key: "Content-Security-Policy",
          value: ContentSecurityPolicy,
        },
      ]),
];

const nextConfig: NextConfig = {
  // Finding 4 — don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.s3.*.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },

  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/.prisma/client/**"],
  },

  // Security headers on all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Cache static assets aggressively
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: "/proposals/:id",
        destination: "/tenders/:id/proposals",
        permanent: false,
      },
    ];
  },

  // Production-only: bundle analyzer
  // Run with ANALYZE=true npm run build
  ...(process.env.ANALYZE === "true"
    ? {
        // @ts-ignore
        bundleAnalyzer: { enabled: true },
      }
    : {}),
};

export default nextConfig;
