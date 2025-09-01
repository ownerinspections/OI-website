import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "oi_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/api/auth");
  const isDashboard = pathname.startsWith("/dashboard");

  const hasSession = req.cookies.has(AUTH_COOKIE);
  const directusAccess =
    req.cookies.get("directus_session_token")?.value ||
    req.cookies.get("directus_access_token")?.value ||
    req.cookies.get("access_token")?.value ||
    null;
  const loggedOutMarker = req.cookies.get("oi_logged_out")?.value === "1";
  const hasDirectusRefresh = Boolean(req.cookies.get("directus_refresh_token")?.value);
  try {
    const hasDirectusSession = Boolean(directusAccess);
    // Note: console.log works in edge runtime for debugging; ensure not verbose in prod.
    console.log("[middleware] path=", pathname, {
      hasOiSession: hasSession,
      hasDirectusSession,
      hasDirectusRefresh,
      loggedOutMarker,
    });
  } catch {}

  // Bridge: if arriving to /login with a valid Directus access token but without an oi_session,
  // mint the oi_session here and send the user to the dashboard.
  if (pathname === "/login" && !hasSession && directusAccess && !loggedOutMarker) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    const res = NextResponse.redirect(url);
    try {
      res.cookies.set(
        AUTH_COOKIE,
        JSON.stringify({ user: { id: "", email: "" }, token: directusAccess }),
        { httpOnly: true, sameSite: "lax", path: "/" }
      );
      console.log("[middleware] minted oi_session from directus token and redirecting to /dashboard");
    } catch {}
    return res;
  }

  if (isDashboard && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};


