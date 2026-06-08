import { NextResponse } from "next/server";
import { logoutUrl, isOidcAuth } from "@/lib/auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/oidc/logout — clear the session and end the IdP session. */
export async function GET() {
  if (!isOidcAuth()) {
    return NextResponse.json({ error: "OIDC auth is not enabled" }, { status: 404 });
  }
  const url = await logoutUrl();
  return NextResponse.redirect(url);
}
