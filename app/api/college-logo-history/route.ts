import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { loadHistoricCollegeImages } from "@/lib/collegeVintageLogos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const name = req.nextUrl.searchParams.get("team")?.trim() || "";
  const league = req.nextUrl.searchParams.get("league") || "";
  if (!["CBB", "CFB"].includes(league) || name.length < 4 || name.length > 100 || !/^[\w\s.&'()\-]+$/.test(name))
    return NextResponse.json({ ok: false, logos: [], error: "Invalid team." }, { status: 400 });
  try {
    const logos = await loadHistoricCollegeImages(name);
    return NextResponse.json({ ok: true, logos }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    // Other logo options must keep working if the historical archive is unavailable.
    return NextResponse.json({ ok: true, logos: [], note: "Historical catalogue temporarily unavailable." });
  }
}
