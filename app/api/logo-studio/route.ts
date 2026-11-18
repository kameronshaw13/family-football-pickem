import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { logoKeyFromSource } from "@/lib/logoStudio";
import { getDivisionOneLogoDirectory, type CollegeLogoDirectoryEntry } from "@/lib/d1LogoDirectory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeamRow = CollegeLogoDirectoryEntry | { league: "NBA" | "NFL"; name: string; logo: string; key: string };

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const supabase = getSupabaseAdmin();
  const teams = new Map<string, TeamRow>();

  // NBA and NFL keep their existing known team names and ESPN logo IDs.
  for (let page = 0; page < 6; page++) {
    const { data, error } = await supabase.from("games")
      .select("league,home_team,away_team,home_logo_url,away_logo_url")
      .in("league", ["NBA", "NFL"])
      .order("commence_time", { ascending: false })
      .range(page * 1000, page * 1000 + 999);
    if (error) return NextResponse.json({ ok: false, error: "Team directory unavailable." }, { status: 503 });
    for (const game of data || []) {
      for (const side of ["home", "away"] as const) {
        const name = String(game[`${side}_team`] || "").trim();
        const logo = String(game[`${side}_logo_url`] || "");
        const key = logoKeyFromSource(logo);
        if (!name || !key || !logo) continue;
        const rowId = game.league + ":" + key;
        if (!teams.has(rowId)) teams.set(rowId, { league: game.league as "NBA" | "NFL", name, logo, key });
      }
    }
    if ((data || []).length < 1000) break;
  }

  let collegeAvailable = true;
  try {
    for (const team of await getDivisionOneLogoDirectory()) teams.set("College:" + team.key, team);
  } catch {
    collegeAvailable = false;
  }

  return NextResponse.json({
    ok: true,
    teams: [...teams.values()].sort((a, b) => a.league.localeCompare(b.league) || a.name.localeCompare(b.name)),
    collegeAvailable
  }, { headers: { "Cache-Control": "private, max-age=300" } });
}
