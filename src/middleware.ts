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
  "/checkout(.*)",         // Checkout funnel — self-gates auth, preserves plan
  "/sitemap.xml",          // SEO — public
  "/robots.txt",           // SEO — public
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",     // Clerk webhook — verified via svix signature
  "/api/auth/oidc(.*)",    // On-prem OIDC login/callback/logout — pre-session
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

const IS_OIDC = process.env.AUTH_PROVIDER === "oidc";

/** Rate-limit guard shared by both auth providers. Returns a 429 response or null. */
async function rateGuard(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/api/webhooks") || pathname === "/api/health") return null;

  const opts = isAIRoute(req)
    ? RATE_LIMITS.aiGeneration
    : isUploadRoute(req)
    ? RATE_LIMITS.upload
    : isExportRoute(req)
    ? RATE_LIMITS.export
    : isAuthRoute(req)
    ? RATE_LIMITS.auth
    : RATE_LIMITS.api;

  const result = await rateLimit(req, opts);
  return result.success ? null : tooManyRequests(result.resetIn);
}

/** Security response headers shared by both auth providers. */
function withSecurityHeaders(res: NextResponse): NextResponse {
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Request-ID", crypto.randomUUID());
  return res;
}

// ── Cloud: Clerk middleware ─────────────────────────────────────────────────────
const clerkHandler = clerkMiddleware(async (auth, req: NextRequest) => {
  const limited = await rateGuard(req);
  if (limited) return limited;
  // Pages redirect to sign-in; API routes self-authenticate.
  if (!isPublicRoute(req) && !isApiRoute(req)) {
    await auth.protect();
  }
  return withSecurityHeaders(NextResponse.next());
});

// ── On-prem: OIDC cookie gate (full JWT verify happens in getOidcAuthContext) ───
async function oidcHandler(req: NextRequest): Promise<NextResponse> {
  const limited = await rateGuard(req);
  if (limited) return limited;
  if (!isPublicRoute(req) && !isApiRoute(req)) {
    if (!req.cookies.get("tos_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/api/auth/oidc/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return withSecurityHeaders(NextResponse.next());
}

export default IS_OIDC ? oidcHandler : clerkHandler;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    "/(api|trpc)(.*)",
  ],
};
