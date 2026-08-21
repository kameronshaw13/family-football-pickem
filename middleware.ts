import { NextRequest, NextResponse } from "next/server";

const VALID_GROUPS = new Set(["shaw-family", "other-family", "friends"]);

function groupForPath(pathname: string, app: string | null) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "friends";
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) return "other-family";
  if (pathname === "/login" && VALID_GROUPS.has(app || "")) return app;
  if (pathname === "/") return "shaw-family";
  return null;
}

function groupFromReferer(request: NextRequest) {
  const explicit = request.headers.get("x-pickem-group");
  if (VALID_GROUPS.has(explicit || "")) return explicit;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return groupForPath(new URL(referer).pathname, null);
  } catch {
    return null;
  }
}

function groupForLogin(request: NextRequest) {
  const explicit = request.nextUrl.searchParams.get("app");
  if (VALID_GROUPS.has(explicit || "")) return explicit;
  const fromReferer = groupFromReferer(request);
  if (fromReferer) return fromReferer;
  const fromCookie = request.cookies.get("pickem_group")?.value;
  return VALID_GROUPS.has(fromCookie || "") ? fromCookie! : "shaw-family";
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/other-family" || pathname.startsWith("/other-family/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/other-family/, "/caleb-family");
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/login") {
    const group = groupForLogin(request);
    if (group === "friends") {
      const url = request.nextUrl.clone();
      url.pathname = "/friends/login";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
    if (group === "other-family") {
      const url = request.nextUrl.clone();
      url.pathname = "/caleb-family";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }
  }

  if (pathname.startsWith("/api/")) {
    const group = groupFromReferer(request);
    if (!group) return NextResponse.next();
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pickem-group", group);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const group = groupForPath(pathname, request.nextUrl.searchParams.get("app"));
  if (!group) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pickem-group", group);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
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
