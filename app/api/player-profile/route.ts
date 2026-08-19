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

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const requestedName = req.nextUrl.searchParams.get("name")?.trim();
    if (!requestedName) return NextResponse.json({ ok: false, error: "Missing player name." }, { status: 400 });
    const supabase = getSupabaseAdmin();

    const [profilesResult, picksResult, sideBetsResult] = await Promise.all([
      supabase.from("profiles").select("id,display_name").order("display_name", { ascending: true }),
      supabase.from("picks").select("*, game:games(id,commence_time,away_team,home_team)").order("created_at", { ascending: true }),
      supabase.from("side_bets").select("id,creator_id,accepted_by,amount,status,result,winner_id,week")
    ]);
    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (picksResult.error) throw new Error(picksResult.error.message);
    if (sideBetsResult.error) throw new Error(sideBetsResult.error.message);

    const profiles = profilesResult.data || [];
    const player = profiles.find((profile) => profile.display_name.toLowerCase() === requestedName.toLowerCase());
    if (!player) return NextResponse.json({ ok: false, error: "Player not found." }, { status: 404 });

    const allLocked = (picksResult.data || []).filter((pick) => pick.status === "locked");
    const playerPicks = allLocked.filter((pick) => pick.user_id === player.id);
    const standings = computeWeeklyStandings(profiles, allLocked as any);
    const standing = standings.find((row) => row.user_id === player.id) || { wins: 0, losses: 0, pushes: 0, win_pct: 0 };

    const completedDogs = playerPicks.filter((pick) => pick.pick_type === "underdog" && pick.result !== "pending");
    const dogWins = completedDogs.filter((pick) => pick.result === "win").length;
    const dogLosses = completedDogs.filter((pick) => pick.result === "loss").length;
    const dogPushes = completedDogs.filter((pick) => pick.result === "push").length;
    const longestDog = completedDogs
      .filter((pick) => pick.result === "win" && Number(pick.locked_spread) > 0)
      .sort((a, b) => Number(b.locked_spread) - Number(a.locked_spread))[0] || null;

    const mostPickedTeam = mostCommon(playerPicks.map((pick) => pick.selected_team));
    const completedPicks = playerPicks
      .filter((pick) => pick.result !== "pending")
      .sort((a, b) => new Date(a.game?.commence_time || a.created_at).getTime() - new Date(b.game?.commence_time || b.created_at).getTime());
    let bestStreak = 0;
    let streak = 0;
    for (const pick of completedPicks) {
      if (pick.result === "win") {
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
      } else if (pick.result === "loss") {
        streak = 0;
      }
    }

    const byWeek = new Map<number, any[]>();
    for (const pick of allLocked) {
      const week = Number(pick.week);
      const rows = byWeek.get(week) || [];
      rows.push(pick);
      byWeek.set(week, rows);
    }
    let weeklyWins = 0;
    const completedWeeks: Array<{ week: number; standings: ReturnType<typeof computeWeeklyStandings> }> = [];
    for (const [week, rows] of Array.from(byWeek.entries())) {
      if (!rows.length || rows.some((pick) => pick.result === "pending")) continue;
      const weekStandings = computeWeeklyStandings(profiles, rows as any);
      completedWeeks.push({ week, standings: weekStandings });
      const row = weekStandings.find((item) => item.user_id === player.id);
      if (row?.rank === 1) weeklyWins += 1;
    }

    const settledSideBets = (sideBetsResult.data || []).filter((bet) => bet.status === "settled" && (bet.creator_id === player.id || bet.accepted_by === player.id));
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

    const headToHead = profiles.filter((opponent) => opponent.id !== player.id).map((opponent) => {
      let wins = 0;
      let losses = 0;
      let ties = 0;
      for (const week of completedWeeks) {
        const mine = week.standings.find((row) => row.user_id === player.id);
        const theirs = week.standings.find((row) => row.user_id === opponent.id);
        if (!mine || !theirs) continue;
        if (mine.rank < theirs.rank) wins += 1;
        else if (mine.rank > theirs.rank) losses += 1;
        else ties += 1;
      }

      const versusBets = settledSideBets.filter((bet) =>
        (bet.creator_id === player.id && bet.accepted_by === opponent.id) ||
        (bet.creator_id === opponent.id && bet.accepted_by === player.id)
      );
      let betWins = 0;
      let betLosses = 0;
      let betPushes = 0;
      let net = 0;
      for (const bet of versusBets) {
        if (bet.result === "push") {
          betPushes += 1;
          continue;
        }
        const won = bet.winner_id === player.id;
        if (won) betWins += 1;
        else betLosses += 1;
        net += won ? Number(bet.amount) : -Number(bet.amount);
      }
      return { opponent: opponent.display_name, pickem: { wins, losses, ties }, sideBets: { wins: betWins, losses: betLosses, pushes: betPushes, net, netText: money(net) } };
    });

    return NextResponse.json({
      ok: true,
      player: { id: player.id, displayName: player.display_name },
      season: { wins: standing.wins, losses: standing.losses, pushes: standing.pushes, winPct: standing.win_pct, weeklyWins },
      legacy: { titles: null, titlesTracked: false },
      signature: {
        longestDog: longestDog ? { team: longestDog.selected_team, spread: Number(longestDog.locked_spread) } : null,
        mostPickedTeam,
        bestPickStreak: bestStreak,
        dogRecord: { wins: dogWins, losses: dogLosses, pushes: dogPushes }
      },
      sideBets: { wins: sideBetWins, losses: sideBetLosses, pushes: sideBetPushes, net: sideBetNet, netText: money(sideBetNet) },
      headToHead
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
