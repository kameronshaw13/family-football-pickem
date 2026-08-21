import { NextRequest, NextResponse } from "next/server";

function groupForPath(pathname: string, app: string | null) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "friends";
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) return "other-family";
  if (pathname === "/login" && ["shaw-family", "other-family", "friends"].includes(app || "")) return app;
  if (pathname === "/") return "shaw-family";
  return null;
}

function calebFamilyPublicPath(pathname: string) {
  return pathname === "/other-family" || pathname.startsWith("/other-family/")
    ? pathname.replace(/^\/other-family/, "/caleb-family")
    : null;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const redirectPath = calebFamilyPublicPath(pathname);
  if (redirectPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = redirectPath;
    return NextResponse.redirect(redirectUrl, 308);
  }

  const group = groupForPath(pathname, request.nextUrl.searchParams.get("app"));
  if (!group) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pickem-group", group);

  let response: NextResponse;
  if (pathname === "/caleb-family" || pathname.startsWith("/caleb-family/")) {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = pathname.replace(/^\/caleb-family/, "/other-family");
    response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

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
  matcher: ["/", "/friends/:path*", "/caleb-family/:path*", "/other-family/:path*", "/login"]
};
