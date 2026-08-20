import { NextRequest, NextResponse } from "next/server";

function groupForPath(pathname: string, app: string | null) {
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "friends";
  if (pathname === "/other-family" || pathname.startsWith("/other-family/")) return "other-family";
  if (pathname === "/login" && ["shaw-family", "other-family", "friends"].includes(app || "")) return app;
  if (pathname === "/") return "shaw-family";
  return null;
}

export function middleware(request: NextRequest) {
  const group = groupForPath(request.nextUrl.pathname, request.nextUrl.searchParams.get("app"));
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
  matcher: ["/", "/friends/:path*", "/other-family/:path*", "/login"]
};
