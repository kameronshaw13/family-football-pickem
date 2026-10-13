import { NextRequest, NextResponse } from "next/server";
import { appSlugForPath, isPickemAppSlug } from "@/lib/appIdentity";

function explicitGroup(request: NextRequest) {
  const value = request.headers.get("x-pickem-group");
  return isPickemAppSlug(value) ? value : null;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // These branches are design previews of real leagues, not staging databases.
  // Keep account sign-in available, but reject all other mutable API requests.
  if (
    process.env.VERCEL_ENV === "preview" &&
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !pathname.startsWith("/api/auth/login") &&
    !pathname.startsWith("/api/auth/logout")
  ) {
    return NextResponse.json(
      { ok: false, error: "This full-app design preview is read-only. Use the live app to submit picks or side bets." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (pathname === "/other-family" || pathname.startsWith("/other-family/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/other-family/, "/caleb-family");
    return NextResponse.redirect(url, 308);
  }

  if (pathname.startsWith("/api/")) {
    const group = explicitGroup(request);
    if (!group) return NextResponse.next();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pickem-group", group);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const group = appSlugForPath(pathname);
  if (!group) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pickem-group", group);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Keep the cookie only as a legacy server-side fallback. It no longer decides
  // which app a route or login belongs to; the URL is the source of truth.
  response.cookies.set("pickem_group", group, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365
  });
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/", "/friends/:path*", "/caleb-family/:path*", "/other-family/:path*", "/login"]
};
