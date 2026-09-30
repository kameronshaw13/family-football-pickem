import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type League = "CFB" | "NFL";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const seasonYear = now.getUTCMonth() >= 5 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const seasonWindowStart = new Date(Date.UTC(seasonYear, 5, 1)).toISOString();
  const seasonWindowEnd = new Date(Date.UTC(seasonYear + 1, 2, 1)).toISOString();

  const { data, error } = await supabase
    .from("games")
    .select("league,week,commence_time")
    .in("league", ["CFB", "NFL"])
    .gte("commence_time", seasonWindowStart)
    .lt("commence_time", seasonWindowEnd)
    .order("commence_time", { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byLeague: Record<League, Map<number, { firstKickoff: string; lastKickoff: string }>> = {
    CFB: new Map(),
    NFL: new Map()
  };

  for (const row of data || []) {
    const league = String(row.league || "").toUpperCase() as League;
    const week = Number(row.week);
    const time = String(row.commence_time || "");
    if (!byLeague[league] || !Number.isFinite(week) || !time) continue;
    const current = byLeague[league].get(week);
    if (!current) {
      byLeague[league].set(week, { firstKickoff: time, lastKickoff: time });
      continue;
    }
    if (time < current.firstKickoff) current.firstKickoff = time;
    if (time > current.lastKickoff) current.lastKickoff = time;
  }

  function options(league: League) {
    return Array.from(byLeague[league].entries())
      .map(([week, range]) => ({ week, ...range }))
      .sort((a, b) => new Date(a.firstKickoff).getTime() - new Date(b.firstKickoff).getTime());
  }

  function nextFullyUnstartedWeek(rows: ReturnType<typeof options>, fallback: number) {
    return rows.find((row) => new Date(row.firstKickoff).getTime() > now.getTime())?.week ?? fallback;
  }

  const cfb = options("CFB");
  const nfl = options("NFL");

  return NextResponse.json({
    ok: true,
    seasonYear,
    CFB: {
      seasonStartWeek: 0,
      nextAvailableWeek: nextFullyUnstartedWeek(cfb, 0),
      options: cfb
    },
    NFL: {
      seasonStartWeek: 1,
      nextAvailableWeek: nextFullyUnstartedWeek(nfl, 1),
      options: nfl
    }
  });
}
