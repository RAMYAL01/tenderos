import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Public routes — accessible without authentication.
 * Everything else is protected by Clerk.
 */
const isPublicRoute = createRouteMatcher([
  "/",                   // landing page
  "/about(.*)",          // marketing — public
  "/contact(.*)",        // marketing — public
  "/sign-in(.*)",        // Clerk sign-in pages
  "/sign-up(.*)",        // Clerk sign-up pages
  "/api/webhooks(.*)",   // Clerk webhook — verified via svix signature, NOT by Clerk session
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    // Redirect unauthenticated users to sign-in
    await auth.protect();
  }

  // Add security headers to every response
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return res;
});

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files with extensions
     */
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
