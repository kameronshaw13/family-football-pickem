import { NextRequest, NextResponse } from "next/server";

function groupForPath(pathname: string, app: string | null) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "friends";
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) return "other-family";
  if (pathname === "/login" && ["shaw-family", "other-family", "friends"].includes(app || "")) return app;
  if (pathname === "/") return "shaw-family";
  return null;
}

function groupFromReferer(request: NextRequest) {
  const explicit = request.headers.get("x-pickem-group");
  if (["shaw-family", "other-family", "friends"].includes(explicit || "")) return explicit;
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return groupForPath(new URL(referer).pathname, null);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/other-family" || pathname.startsWith("/other-family/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/other-family/, "/caleb-family");
    return NextResponse.redirect(url, 308);
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
