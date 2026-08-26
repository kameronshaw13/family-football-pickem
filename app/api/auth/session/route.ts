import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getProfileFromRequest, setSessionCookie } from "@/lib/authServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile || !auth.token) {
    const response = NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    clearSessionCookie(response);
    return response;
  }

  const response = NextResponse.json({ ok: true, token: auth.token, profile: auth.profile }, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
  setSessionCookie(response, auth.token);
  return response;
}
