import { NextResponse } from "next/server";
import { completeLogin, isOidcAuth } from "@/lib/auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

/** GET /api/auth/oidc/callback — exchange the code, set the session, land on the dashboard. */
export async function GET(req: Request) {
  if (!isOidcAuth()) {
    return NextResponse.json({ error: "OIDC auth is not enabled" }, { status: 404 });
  }
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) return NextResponse.redirect(`${APP}/sign-in?error=${encodeURIComponent(error)}`);
  if (!code || !state) {
    return NextResponse.redirect(`${APP}/sign-in?error=missing_code`);
  }

  try {
    await completeLogin(code, state);
  } catch (err) {
    console.error("[oidc] callback failed:", err);
    return NextResponse.redirect(`${APP}/sign-in?error=oidc_failed`);
  }
  return NextResponse.redirect(`${APP}/dashboard`);
}
