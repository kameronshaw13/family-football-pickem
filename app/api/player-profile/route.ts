import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
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

function seasonYearFrom(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const year = date.getFullYear();
  if (!Number.isFinite(year)) return null;
  return date.getMonth() < 2 ? year - 1 : year;
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

    const [profilesResult, picksResult, sideBetsResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name").order("display_name", { ascending: true }),
      supabase.from("picks").select("*, game:games(id,commence_time,away_team,home_team)").order("created_at", { ascending: true }),
      supabase.from("side_bets").select("id,creator_id,accepted_by,amount,status,result,winner_id,week,created_at")
    ]);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (picksResult.error) throw new Error(picksResult.error.message);
    if (sideBetsResult.error) throw new Error(sideBetsResult.error.message);

    const profiles = profilesResult.data || [];
    const player = profiles.find((profile) => profile.display_name.toLowerCase() === requestedName.toLowerCase());
    if (!player) return NextResponse.json({ ok: false, error: "Player not found." }, { status: 404 });

    const allPicks = picksResult.data || [];
    const allLocked = allPicks.filter((pick) => pick.status === "locked");
    const allSideBets = sideBetsResult.data || [];
    const availableYears = Array.from(new Set([
      ...allPicks.map((pick) => seasonYearFrom(pick.game?.commence_time || pick.created_at)),
      ...allSideBets.map((bet) => seasonYearFrom(bet.created_at))
    ].filter((year): year is number => year != null))).sort((a, b) => b - a);

    const selectedYear = requestedYear && availableYears.includes(requestedYear) ? requestedYear : null;
    const periodLocked = selectedYear == null
      ? allLocked
      : allLocked.filter((pick) => seasonYearFrom(pick.game?.commence_time || pick.created_at) === selectedYear);
    const playerPicks = periodLocked.filter((pick) => pick.user_id === player.id);
    const standings = computeWeeklyStandings(profiles, periodLocked as any);
    const standing = standings.find((row) => row.user_id === player.id) || { wins: 0, losses: 0, pushes: 0, win_pct: 0 };

    const completedDogs = playerPicks.filter((pick) => pick.pick_type === "underdog" && pick.result !== "pending");
    const longestDog = completedDogs
      .filter((pick) => pick.result === "win" && Number(pick.locked_spread) > 0)
      .sort((a, b) => Number(b.locked_spread) - Number(a.locked_spread))[0] || null;
    const mostPickedTeam = mostCommon(playerPicks.map((pick) => pick.selected_team));

    const settledSideBets = allSideBets.filter((bet) =>
      bet.status === "settled" &&
      (bet.creator_id === player.id || bet.accepted_by === player.id) &&
      (selectedYear == null || seasonYearFrom(bet.created_at) === selectedYear)
    );
    let sideBetWins = 0;
    let sideBetLosses = 0;
    let sideBetPushes = 0;
    let sideBetNet = 0;
    for (const bet of settledSideBets) {
      if (bet.result === "push") {
        sideBetPushes += 1;
        continue;
      }
      const won = bet.winner_id === player.id;
      if (won) sideBetWins += 1;
      else sideBetLosses += 1;
      sideBetNet += won ? Number(bet.amount) : -Number(bet.amount);
    }

    return NextResponse.json({
      ok: true,
      player: { id: player.id, displayName: player.display_name },
      period: {
        selected: selectedYear == null ? "all" : String(selectedYear),
        label: selectedYear == null ? "All Time" : String(selectedYear),
        availableYears
      },
      season: {
        wins: standing.wins,
        losses: standing.losses,
        pushes: standing.pushes,
        winPct: standing.win_pct
      },
      legacy: { titles: null, titlesTracked: false },
      signature: {
        longestDog: longestDog ? { team: longestDog.selected_team, spread: Number(longestDog.locked_spread) } : null,
        mostPickedTeam
      },
      sideBets: {
        wins: sideBetWins,
        losses: sideBetLosses,
        pushes: sideBetPushes,
        net: sideBetNet,
        netText: money(sideBetNet)
      }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
