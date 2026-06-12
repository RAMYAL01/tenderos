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
  "/pricing(.*)",          // Marketing — public
  "/contact(.*)",          // Marketing — public
  "/blog(.*)",             // Blog — public
  "/solutions(.*)",        // SEO pillar pages — public
  "/tender-software(.*)",  // Programmatic SEO pages — public
  "/terms(.*)",            // Legal — public
  "/privacy(.*)",          // Legal — public
  "/refund(.*)",           // Legal — public
  "/trust(.*)",            // Trust Center — public
  "/checkout(.*)",         // Checkout funnel — self-gates auth, preserves plan
  "/sitemap.xml",          // SEO — public
  "/robots.txt",           // SEO — public
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",           // Team invite links — self-gate (show sign-in CTA when logged out)
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

// Org-first onboarding: the ONLY protected page a user without an active
// organization may reach. Exempting it here is what prevents a redirect loop.
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

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

  // Pages redirect to sign-in; API routes self-authenticate (they return JSON
  // 401s themselves, so we don't auth.protect() them here).
  if (!isPublicRoute(req) && !isApiRoute(req)) {
    await auth.protect();

    // ── Org-first gate (the bulletproof edge check) ──────────────────────────
    // A signed-in user with NO active organization (no company workspace yet)
    // may ONLY reach /onboarding. Every other protected page is forced back to
    // /onboarding. Because /onboarding is exempted, there is no redirect loop.
    //
    // This is the single source of truth for the "must have a company" rule and
    // covers every escape route at once: deep links to /dashboard, a stale tab,
    // or a user who closed the browser mid-onboarding and signs back in later.
    const { userId, orgId } = await auth();
    if (userId && !orgId && !isOnboardingRoute(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return withSecurityHeaders(NextResponse.redirect(url));
    }
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
