import { NextResponse } from "next/server";
import type { PickemAppSlug } from "./authUsers";

export const DEFAULT_LEAGUE_COOKIE = "pickem_default_league";

// This is only a navigation hint, never an authentication or access-grant token.
// Destination APIs still enforce each profile's current league membership.
export function setDefaultLeagueCookie(response: NextResponse, slug: PickemAppSlug | null) {
  response.cookies.set(DEFAULT_LEAGUE_COOKIE, slug || "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: slug ? 60 * 60 * 24 * 30 : 0
  });
}
