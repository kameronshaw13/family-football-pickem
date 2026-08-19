import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { computeWeeklyStandings } from "@/lib/weeklyBank";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function money(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toFixed(Number.isInteger(Math.abs(value)) ? 0 : 2)}`;
}
function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null;
}
function recordFor(picks: any[]) {
  let wins = 0, losses = 0, pushes = 0;
  for (const pick of picks) {
    if (pick.result === "win") wins += 1;
    else if (pick.result === "loss") losses += 1;
    else if (pick.result === "push") pushes += 1;
  }
  return { wins, losses, pushes };
}
function dogBonusWins(pick: any) {
  const stored = Number(pick?.underdog_win_value);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const spread = Number(pick?.locked_spread);
  if (spread >= 20) return 3;
  if (spread >= 10) return 2;
  if (spread >= 7) return 1;
  return 0;
}

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  try {
    const requestedName = req.nextUrl.searchParams.get("name")?.trim();
    if (!requestedName) return NextResponse.json({ ok: false, error: "Missing player name." }, { status: 400 });
    const requestedYearText = req.nextUrl.searchParams.get("year")?.trim() || "all";
    const requestedYear = /^\d{4}$/.test(requestedYearText) ? Number(requestedYearText) : null;
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const player = context.members.find((member) => member.display_name.toLowerCase() === requestedName.toLowerCase());
    if (!player) return NextResponse.json({ ok: false, error: "Player not found in this Pick'em group." }, { status: 404 });

    const [picksResult, sideBetsResult, historyResult] = await Promise.all([
      supabase.from("picks").select("*, game:games(id,commence_time,away_team,home_team)").eq("group_id", context.group.id).order("created_at", { ascending: true }),
      supabase.from("side_bets").select("id,group_id,season_year,creator_id,accepted_by,amount,status,result,winner_id,week,created_at").eq("group_id", context.group.id),
      supabase.from("group_season_results").select("season_year,is_champion").eq("group_id", context.group.id).eq("profile_id", player.id)
    ]);
    if (picksResult.error) throw new Error(picksResult.error.message);
    if (sideBetsResult.error) throw new Error(sideBetsResult.error.message);
    if (historyResult.error) throw new Error(historyResult.error.message);

    const allPicks = picksResult.data || [];
    const allSideBets = sideBetsResult.data || [];
    const availableYears = Array.from(new Set([
      context.seasonYear,
      ...allPicks.map((pick: any) => Number(pick.season_year)).filter(Number.isFinite),
      ...allSideBets.map((bet: any) => Number(bet.season_year)).filter(Number.isFinite),
      ...(historyResult.data || []).map((row: any) => Number(row.season_year)).filter(Number.isFinite)
    ])).sort((a, b) => b - a);
    const selectedYear = requestedYear && availableYears.includes(requestedYear) ? requestedYear : null;
    const periodLocked = allPicks.filter((pick: any) => pick.status === "locked" && (selectedYear == null || Number(pick.season_year) === selectedYear));
    const playerPicks = periodLocked.filter((pick: any) => pick.user_id === player.id);
    const standings = computeWeeklyStandings(context.members, periodLocked as any);
    const standing = standings.find((row) => row.user_id === player.id) || { wins: 0, losses: 0, pushes: 0, win_pct: 0 };

    const completedDogs = playerPicks.filter((pick: any) => pick.pick_type === "underdog" && pick.result !== "pending");
    const longestDog = completedDogs.filter((pick: any) => pick.result === "win" && Number(pick.locked_spread) > 0).sort((a: any, b: any) => Number(b.locked_spread) - Number(a.locked_spread))[0] || null;
    const mostPickedTeam = mostCommon(playerPicks.map((pick: any) => pick.selected_team));
    const favoriteTeamCompletedPicks = mostPickedTeam ? playerPicks.filter((pick: any) => pick.selected_team === mostPickedTeam && pick.result !== "pending") : [];
    const mostPickedTeamRecord = mostPickedTeam ? recordFor(favoriteTeamCompletedPicks) : null;
    const longestDogOpponent = longestDog?.game ? longestDog.selected_team === longestDog.game.away_team ? longestDog.game.home_team : longestDog.game.away_team : null;

    const settledSideBets = allSideBets.filter((bet: any) => bet.status === "settled" && (bet.creator_id === player.id || bet.accepted_by === player.id) && (selectedYear == null || Number(bet.season_year) === selectedYear));
    let sideBetWins = 0, sideBetLosses = 0, sideBetPushes = 0, sideBetNet = 0;
    for (const bet of settledSideBets) {
      if (bet.result === "push") { sideBetPushes += 1; continue; }
      const won = bet.winner_id === player.id;
      if (won) sideBetWins += 1; else sideBetLosses += 1;
      sideBetNet += won ? Number(bet.amount) : -Number(bet.amount);
    }
    const historyRows = historyResult.data || [];
    const titlesTracked = historyRows.length > 0;
    const titles = historyRows.filter((row: any) => row.is_champion).length;

    return NextResponse.json({
      ok: true,
      player: { id: player.id, displayName: player.display_name },
      period: { selected: selectedYear == null ? "all" : String(selectedYear), label: selectedYear == null ? "All Time" : String(selectedYear), availableYears },
      season: { wins: standing.wins, losses: standing.losses, pushes: standing.pushes, winPct: standing.win_pct },
      legacy: { titles: titlesTracked ? titles : null, titlesTracked },
      signature: {
        longestDog: longestDog ? { team: longestDog.selected_team, spread: Number(longestDog.locked_spread), opponent: longestDogOpponent, bonusWins: dogBonusWins(longestDog) } : null,
        mostPickedTeam,
        mostPickedTeamRecord
      },
      sideBets: { wins: sideBetWins, losses: sideBetLosses, pushes: sideBetPushes, net: sideBetNet, netText: money(sideBetNet) }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
