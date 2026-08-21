import { NextRequest, NextResponse } from "next/server";
import { appSlugForPath, isPickemAppSlug } from "@/lib/appIdentity";

function explicitGroup(request: NextRequest) {
  const value = request.headers.get("x-pickem-group");
  return isPickemAppSlug(value) ? value : null;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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
