import { NextResponse } from "next/server";

export async function GET() {
  const res = NextResponse.redirect(new URL("/login", process.env.APP_BASE_URL || "http://localhost:8040"));
  try {
    // Clear app session
    res.cookies.set("oi_session", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    // Clear Directus auth cookies if present
    res.cookies.set("directus_session_token", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    res.cookies.set("directus_access_token", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    res.cookies.set("access_token", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    res.cookies.set("directus_refresh_token", "", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 0 });
    // Marker to avoid immediate auto-bridge after redirect
    res.cookies.set("oi_logged_out", "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 });
  } catch {}
  return res;
}


