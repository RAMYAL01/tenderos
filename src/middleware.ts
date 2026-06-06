import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, RATE_LIMITS, tooManyRequests } from "@/lib/rate-limit";

/**
 * Public routes — accessible without authentication.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/about(.*)",            // Marketing — public
  "/contact(.*)",          // Marketing — public
  "/blog(.*)",             // Blog — public
  "/solutions(.*)",        // SEO pillar pages — public
  "/tender-software(.*)",  // Programmatic SEO pages — public
  "/sitemap.xml",          // SEO — public
  "/robots.txt",           // SEO — public
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",     // Clerk webhook — verified via svix signature
  "/api/health",           // Health check — always public
]);

/**
 * Routes with stricter rate limiting.
 */
const isAIRoute = createRouteMatcher(["/api/ai(.*)"]);
const isUploadRoute = createRouteMatcher(["/api/documents(.*)"]);
const isExportRoute = createRouteMatcher(["/api/proposals/(.*)/export"]);
const isAuthRoute = createRouteMatcher(["/api/auth(.*)", "/sign-in(.*)", "/sign-up(.*)"]);

// API routes authenticate themselves (each handler calls auth() and returns a
// JSON 401 when unauthenticated). Calling auth.protect() on them in middleware
// returns an HTML 404 page instead, which breaks client-side fetch().json().
const isApiRoute = createRouteMatcher(["/api(.*)"]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  // Apply BEFORE auth check to protect against unauthenticated attacks.

  // Skip rate limiting for webhooks (signature-verified) and health checks
  const pathname = req.nextUrl.pathname;
  const isWebhook = pathname.startsWith("/api/webhooks");
  const isHealth = pathname === "/api/health";

  if (!isWebhook && !isHealth) {
    // Choose rate limit profile
    const rateLimitOptions = isAIRoute(req)
      ? RATE_LIMITS.aiGeneration
      : isUploadRoute(req)
      ? RATE_LIMITS.upload
      : isExportRoute(req)
      ? RATE_LIMITS.export
      : isAuthRoute(req)
      ? RATE_LIMITS.auth
      : RATE_LIMITS.api;

    const rateLimitResult = await rateLimit(req, rateLimitOptions);

    if (!rateLimitResult.success) {
      return tooManyRequests(rateLimitResult.resetIn);
    }
  }

  // ── Auth protection ────────────────────────────────────────────────────────
  // Protect pages (redirects to sign-in). API routes self-authenticate via
  // their own auth() check, so we don't auth.protect() them here.
  if (!isPublicRoute(req) && !isApiRoute(req)) {
    await auth.protect();
  }

  // ── Security response headers ──────────────────────────────────────────────
  const res = NextResponse.next();

  // HSTS — force HTTPS (skip in development)
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }

  // Prevent clickjacking
  res.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Add request ID for tracing (useful in Sentry and logs)
  const requestId = crypto.randomUUID();
  res.headers.set("X-Request-ID", requestId);

  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    "/(api|trpc)(.*)",
  ],
};
