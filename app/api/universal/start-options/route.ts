import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("games")
    .select("league,week,commence_time")
    .in("league", ["CFB", "NFL"])
    .gte("commence_time", now)
    .order("commence_time", { ascending: true })
    .limit(1000);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const byLeague: Record<string, Map<number, string>> = { CFB: new Map(), NFL: new Map() };
  for (const row of data || []) {
    const league = String(row.league || "").toUpperCase();
    const week = Number(row.week);
    if (!byLeague[league] || !Number.isFinite(week)) continue;
    const current = byLeague[league].get(week);
    const time = String(row.commence_time);
    if (!current || time < current) byLeague[league].set(week, time);
  }

  function options(league: "CFB" | "NFL") {
    return Array.from(byLeague[league].entries())
      .sort((a, b) => new Date(a[1]).getTime() - new Date(b[1]).getTime())
      .map(([week, firstKickoff]) => ({ week, firstKickoff }));
  }

  const cfb = options("CFB");
  const nfl = options("NFL");
  return NextResponse.json({
    ok: true,
    seasonYear: new Date().getFullYear(),
    CFB: { seasonStartWeek: 0, nextAvailableWeek: cfb[0]?.week ?? 0, options: cfb },
    NFL: { seasonStartWeek: 1, nextAvailableWeek: nfl[0]?.week ?? 1, options: nfl }
  });
}
