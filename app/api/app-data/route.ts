import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { findEspnLogo, normalizeEspnLogoUrl } from "@/lib/espnLogos";
import { fetchEspnSchedule, findEspnScheduleMatch, resolveEspnCommenceTime } from "@/lib/espnSchedule";
import { getFootballWeek, getGameLockTime, getPickWeekOpenTime } from "@/lib/lockRules";
import { getWeekRule } from "@/lib/weekRules";
import { getProfileFromToken } from "@/lib/authServer";
import { hasChargers, isEligibleRegularSeasonGame } from "@/lib/seasonRules";
import { computeWeeklyStandings } from "@/lib/weeklyBank";

const SCHEDULE_SOURCE_ROLLOUT = new Date("2026-07-23T03:25:00.000Z");

async function getAuthedProfile(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { profile: null, error: "Missing auth token." };
  const profile = await getProfileFromToken(token);
  if (!profile) return { profile: null, error: "Invalid or expired session." };
  return { profile, error: null };
}

export async function GET(req: NextRequest) {
  try {
    const { profile, error } = await getAuthedProfile(req);
    if (!profile) return NextResponse.json({ ok: false, error }, { status: 401 });

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const requestedWeek = req.nextUrl.searchParams.get("week");

    const { data: rawGames, error: gameError } = await supabase.from("games").select("*").order("commence_time", { ascending: true });
    if (gameError) return NextResponse.json({ ok: false, error: gameError.message }, { status: 500 });
    const requestTime = new Date();
    const spreadGames = (rawGames || []).filter((game) =>
      isEligibleRegularSeasonGame(game) &&
      !hasChargers(game) &&
      game.current_spread_team != null &&
      game.current_spread != null
    );
    let reconciledGames = spreadGames;
    const needsScheduleBackfill = spreadGames.some((game) =>
      !game.updated_at || new Date(game.updated_at) < SCHEDULE_SOURCE_ROLLOUT
    );

    if (needsScheduleBackfill) {
      const schedules = new Map<string, Awaited<ReturnType<typeof fetchEspnSchedule>>>();
      await Promise.all((["CFB", "NFL"] as const).map(async (league) => {
        const leagueGames = spreadGames.filter((game) => game.league === league);
        if (!leagueGames.length) return;
        try {
          schedules.set(league, await fetchEspnSchedule(league, leagueGames.map((game) => game.commence_time)));
        } catch {
          schedules.set(league, []);
        }
      }));

      const manualLogoMap = new Map<string, string>();
      const backfilledAt = new Date().toISOString();
      reconciledGames = spreadGames.map((game) => {
        const scheduleMatch = findEspnScheduleMatch(game, schedules.get(game.league) || []);
        if (!scheduleMatch) return { ...game, updated_at: backfilledAt };
        const commenceTime = resolveEspnCommenceTime(scheduleMatch, game.commence_time);
        const homeTeam = scheduleMatch.swapped ? game.away_team : game.home_team;
        const awayTeam = scheduleMatch.swapped ? game.home_team : game.away_team;
        const lockTime = getGameLockTime(commenceTime).toISOString();
        return {
          ...game,
          week: getFootballWeek(commenceTime),
          commence_time: commenceTime,
          home_team: homeTeam,
          away_team: awayTeam,
          home_logo_url: scheduleMatch.game.homeTeam.logoUrl || findEspnLogo(homeTeam, manualLogoMap) || game.home_logo_url,
          away_logo_url: scheduleMatch.game.awayTeam.logoUrl || findEspnLogo(awayTeam, manualLogoMap) || game.away_logo_url,
          lock_time: lockTime,
          is_locked: requestTime >= new Date(lockTime),
          updated_at: backfilledAt
        };
      });

      const { error: backfillError } = await supabase.from("games").upsert(reconciledGames, { onConflict: "id" });
      if (backfillError) return NextResponse.json({ ok: false, error: `Could not backfill official schedules: ${backfillError.message}` }, { status: 500 });
    }

    const eligibleGames = reconciledGames.map((game) => {
      const lockTime = getGameLockTime(game.commence_time).toISOString();
      return {
        ...game,
        home_logo_url: normalizeEspnLogoUrl(game.home_logo_url),
        away_logo_url: normalizeEspnLogoUrl(game.away_logo_url),
        lock_time: lockTime,
        is_locked: requestTime >= new Date(lockTime)
      };
    });
    const uniqueGames = new Map<string, any>();
    for (const game of eligibleGames) {
      const matchupKey = [game.league, game.week, game.away_team, game.home_team]
        .map((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " "))
        .join(":");
      const existing = uniqueGames.get(matchupKey);
      if (!existing || new Date(game.updated_at || 0) > new Date(existing.updated_at || 0)) {
        uniqueGames.set(matchupKey, game);
      }
    }
    const allGames = Array.from(uniqueGames.values()).sort((a, b) =>
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );
    const gameById = new Map(allGames.map((game) => [game.id, game]));

    const openGames = allGames.filter((g) => new Date(g.commence_time).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000);
    const defaultWeek = openGames[0]?.week ?? allGames?.[0]?.week ?? 0;
    const week = requestedWeek != null ? Number(requestedWeek) : defaultWeek;
    const games = allGames.filter((g) => g.week === week);
    const weekOpen = getPickWeekOpenTime(week, games.map((g) => g.commence_time));

    const [
      profilesResult,
      picksResult,
      allLockedPicksResult,
      standingsResult,
      bankSettingsResult,
      bankEntriesResult,
      sideBetsResult
    ] = await Promise.all([
      supabase.from("profiles").select("id,username,display_name,is_admin").order("display_name", { ascending: true }),
      supabase
        .from("picks")
        .select("*, game:games(*), profile:profiles(id,username,display_name,is_admin)")
        .eq("week", week),
      supabase
        .from("picks")
        .select("user_id,week,pick_type,status,result,underdog_win_value")
        .eq("status", "locked"),
      supabase.from("standings").select("*").order("win_pct", { ascending: false }).order("wins", { ascending: false }),
      supabase.from("bank_settings").select("*").eq("id", 1).maybeSingle(),
      supabase
        .from("bank_entries")
        .select("*, profile:profiles(display_name)")
        .order("week", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("side_bets")
        .select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))")
        .order("created_at", { ascending: false })
    ]);

    const { data: profiles, error: profilesError } = profilesResult;
    const { data: picks, error: picksError } = picksResult;
    const { data: allLockedPicks, error: allLockedPicksError } = allLockedPicksResult;
    const { data: standings, error: standingError } = standingsResult;
    const { data: bankSettings, error: bankSettingsError } = bankSettingsResult;
    const { data: bankEntries, error: bankEntriesError } = bankEntriesResult;
    const { data: allSideBets, error: sideBetError } = sideBetsResult;

    if (profilesError) return NextResponse.json({ ok: false, error: profilesError.message }, { status: 500 });
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });
    if (allLockedPicksError) return NextResponse.json({ ok: false, error: allLockedPicksError.message }, { status: 500 });
    if (standingError) return NextResponse.json({ ok: false, error: standingError.message }, { status: 500 });
    if (bankSettingsError) return NextResponse.json({ ok: false, error: bankSettingsError.message }, { status: 500 });
    if (bankEntriesError) return NextResponse.json({ ok: false, error: bankEntriesError.message }, { status: 500 });
    if (sideBetError) return NextResponse.json({ ok: false, error: `${sideBetError.message} Run the updated Supabase schema before using side bets.` }, { status: 500 });

    const standingsWeeks = Array.from(new Set(allGames.map((game) => Number(game.week))));
    const weeklyStandingsByWeek = Object.fromEntries(standingsWeeks.map((standingWeek) => [
      String(standingWeek),
      computeWeeklyStandings(profiles || [], (allLockedPicks || []).filter((pick) => Number(pick.week) === standingWeek) as any)
    ]));

    const normalizedPicks = (picks || []).map((pick: any) => ({ ...pick, game: gameById.get(pick.game_id) || pick.game }));
    const visiblePicks = normalizedPicks.filter((pick: any) => {
      const game = pick.game;
      if (!game || !isEligibleRegularSeasonGame(game) || hasChargers(game)) return false;
      if (pick.user_id === profile.id) return true;
      return new Date(game.lock_time).toISOString() <= now;
    });

    const expiredIds = (allSideBets || [])
      .filter((bet: any) => bet.status === "open" && bet.game && new Date(bet.game.commence_time) <= new Date())
      .map((bet: any) => bet.id);
    if (expiredIds.length) {
      await supabase.from("side_bets").update({ status: "expired", updated_at: now }).in("id", expiredIds).eq("status", "open");
      await supabase.from("side_bet_targets").update({ response: "closed", responded_at: now }).in("side_bet_id", expiredIds).eq("response", "pending");
    }

    const sideBets = (allSideBets || []).filter((bet: any) =>
      bet.creator_id === profile.id || bet.accepted_by === profile.id || bet.targets?.some((target: any) => target.recipient_id === profile.id)
    ).map((bet: any) => expiredIds.includes(bet.id) ? { ...bet, status: "expired" } : bet);

    const sideBetBankTotals = Object.fromEntries((profiles || []).map((player: any) => [player.id, 0]));
    for (const bet of allSideBets || []) {
      if (bet.status !== "settled" || bet.result === "push" || !bet.accepted_by || !bet.winner_id) continue;
      const loserId = bet.winner_id === bet.creator_id ? bet.accepted_by : bet.creator_id;
      sideBetBankTotals[bet.winner_id] = Number(sideBetBankTotals[bet.winner_id] || 0) + Number(bet.amount);
      sideBetBankTotals[loserId] = Number(sideBetBankTotals[loserId] || 0) - Number(bet.amount);
    }

    return NextResponse.json({
      ok: true,
      currentUser: profile,
      profiles: profiles || [],
      games,
      picks: visiblePicks,
      standings: standings || [],
      weeklyStandingsByWeek,
      bankSettings: bankSettings || { id: 1, winner_amount: 20, loser_amount: 10 },
      bankEntries: bankEntries || [],
      sideBets,
      sideBetBankTotals,
      week,
      weekRule: getWeekRule(week),
      weekOpenTime: weekOpen ? weekOpen.toISOString() : null,
      availableWeeks: Array.from(new Set(allGames.map((g) => g.week))).sort((a, b) => a - b)
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
