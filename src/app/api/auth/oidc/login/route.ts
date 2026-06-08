import { NextResponse } from "next/server";
import { beginLogin, isOidcAuth } from "@/lib/auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/oidc/login — start the OIDC authorization-code flow. */
export async function GET() {
  if (!isOidcAuth()) {
    return NextResponse.json({ error: "OIDC auth is not enabled" }, { status: 404 });
  }
  try {
    const url = await beginLogin();
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[oidc] login init failed:", err);
    return NextResponse.json({ error: "OIDC login unavailable" }, { status: 503 });
  }
}
