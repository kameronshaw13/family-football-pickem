import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { findArchivedTeam, parseHistoricalLogos } from "@/lib/logoHistoryParser";

export const dynamic = "force-dynamic";
const ARCHIVE = "https://logocdn.com";

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const league = req.nextUrl.searchParams.get("league")?.toLowerCase();
  const team = req.nextUrl.searchParams.get("team")?.slice(0, 90) || "";
  if (league !== "nba" && league !== "nfl")
    return NextResponse.json({ ok: false, error: "Historical archive available for NBA and NFL." }, { status: 400 });
  try {
    const response = await fetch(ARCHIVE + "/" + league + "/", { next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error("Archive status " + response.status);
    const rows = parseHistoricalLogos(await response.text(), league);
    if (!rows.length) throw new Error("No verified logo entries.");
    if (team) return NextResponse.json({ ok: true, logos: findArchivedTeam(rows, team)?.logos || [] });
    return NextResponse.json({ ok: true, teams: rows });
  } catch {
    return NextResponse.json({ ok: false, teams: [], logos: [], error: "Historical images unavailable right now." }, { status: 503 });
  }
}
