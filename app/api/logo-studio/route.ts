import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { logoKeyFromSource } from "@/lib/logoStudio";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TeamRow = { league: string; name: string; logo: string; key: string };
export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const supabase = getSupabaseAdmin();
  const teams = new Map<string, TeamRow>();
  for (let page = 0; page < 6; page++) {
    const { data, error } = await supabase.from("games")
      .select("league,home_team,away_team,home_logo_url,away_logo_url")
      .in("league", ["NBA", "NFL", "CBB", "CFB"])
      .order("commence_time", { ascending: false })
      .range(page * 1000, page * 1000 + 999);
    if (error) return NextResponse.json({ ok: false, error: "Team directory unavailable." }, { status: 503 });
    for (const game of data || []) {
      for (const side of ["home", "away"] as const) {
        const name = String(game[`${side}_team`] || "").trim();
        const logo = String(game[`${side}_logo_url`] || "");
        const key = logoKeyFromSource(logo);
        if (!name || !key || !logo) continue;
        // CFB and CBB share the same school identity, but retain both sport filters.
        const id = `${game.league}:${key}`;
        // Rows are newest first. Retain today's canonical name and artwork.
        if (!teams.has(id)) teams.set(id, { league: game.league, name, logo, key });
      }
    }
    if ((data || []).length < 1000) break;
  }
  return NextResponse.json({ ok: true, teams: [...teams.values()].sort((a, b) =>
    a.league.localeCompare(b.league) || a.name.localeCompare(b.name)) }, { headers: { "Cache-Control": "private, max-age=300" } });
}
