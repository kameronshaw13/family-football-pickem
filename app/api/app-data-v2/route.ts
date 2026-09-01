import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { normalizeEspnLogoUrl } from "@/lib/espnLogos";
import { getGroupGameLockTime, getGroupSideBetSettings, getGroupWeekRule, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { computeGroupStandings } from "@/lib/groupScoring";
import { getPickWeekOpenTime } from "@/lib/lockRules";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { sideBetSlotCounts } from "@/lib/sideBetLimits";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const sideBetSettings = getGroupSideBetSettings(context);
    const now = new Date();
    const nowIso = now.toISOString();
    const requestedWeek = req.nextUrl.searchParams.get("week");

    const [gamesResult, lockedResult, bankResult, sideBetResult, seasonMoneyResult, sideBetDismissalResult] = await Promise.all([
      supabase.from("games").select("*").order("commence_time", { ascending: true }),
      supabase.from("picks").select("user_id,week,pick_type,status,result,underdog_win_value,confidence_points").eq("group_id", context.group.id).eq("season_year", context.seasonYear).eq("status", "locked"),
      supabase.from("bank_entries").select("*, profile:profiles(display_name)").eq("group_id", context.group.id).eq("season_year", context.seasonYear).order("week", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("side_bets").select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))").eq("group_id", context.group.id).eq("season_year", context.seasonYear).order("created_at", { ascending: false }),
      supabase.from("group_season_money").select("winner_take_all_amount,updated_by,updated_at,submitted_at").eq("group_id", context.group.id).eq("season_year", context.seasonYear).maybeSingle(),
      supabase.from("side_bet_dismissals").select("side_bet_id").eq("group_id", context.group.id).eq("user_id", auth.profile.id)
    ]);
    for (const result of [gamesResult, lockedResult, bankResult, sideBetResult, seasonMoneyResult, sideBetDismissalResult]) if (result.error) throw new Error(result.error.message);

    const normalizedGames = (gamesResult.data || [])
      .filter((game: any) => isEligibleSeasonGame(game) && isGameAllowedForGroup(context, game) && game.current_spread_team != null && game.current_spread != null)
      .map((game: any) => {
        const lockTime = getGroupGameLockTime(context, game.commence_time).toISOString();
        return {
          ...game,
          home_logo_url: normalizeEspnLogoUrl(game.home_logo_url),
          away_logo_url: normalizeEspnLogoUrl(game.away_logo_url),
          lock_time: lockTime,
          is_locked: now >= new Date(lockTime)
        };
      });
    const unique = new Map<string, any>();
    for (const game of normalizedGames) {
      const key = [game.league, game.week, game.away_team, game.home_team]
        .map((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " "))
        .join(":");
      const prior = unique.get(key);
      if (!prior || new Date(game.updated_at || 0) > new Date(prior.updated_at || 0)) unique.set(key, game);
    }
    const allGames = Array.from(unique.values()).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
    const standingsWeeks = Array.from(new Set(allGames.map((game) => Number(game.week)))).sort((a, b) => a - b);
    const openedWeeks = standingsWeeks.filter((candidateWeek) => {
      const candidateGames = allGames.filter((game) => Number(game.week) === candidateWeek);
      const openTime = getPickWeekOpenTime(candidateWeek, candidateGames.map((game) => game.commence_time), context.group.timezone);
      return !openTime || openTime <= now;
    });
    const defaultWeek = openedWeeks[openedWeeks.length - 1] ?? standingsWeeks[0] ?? 0;
    const week = requestedWeek != null ? Number(requestedWeek) : defaultWeek;
    const games = allGames.filter((game) => Number(game.week) === week);
    const gameById = new Map(allGames.map((game) => [game.id, game]));
    const weekOpen = getPickWeekOpenTime(week, games.map((game) => game.commence_time), context.group.timezone);

    const [picksResult, weekMoneyResult] = await Promise.all([
      supabase.from("picks").select("*, game:games(*), profile:profiles(id,username,display_name,is_admin)").eq("group_id", context.group.id).eq("season_year", context.seasonYear).eq("week", week),
      supabase.from("group_week_money").select("winner_take_all_amount,updated_by,updated_at,submitted_at").eq("group_id", context.group.id).eq("season_year", context.seasonYear).eq("week", week).maybeSingle()
    ]);
    if (picksResult.error) throw new Error(picksResult.error.message);
    if (weekMoneyResult.error) throw new Error(weekMoneyResult.error.message);

    let allSideBets = sideBetResult.data || [];
    const expiredIds = allSideBets
      .filter((bet: any) => bet.status === "open" && bet.game && new Date(bet.game.commence_time) <= now)
      .map((bet: any) => bet.id);
    if (expiredIds.length) {
      await Promise.all([
        supabase.from("side_bets").update({ status: "expired", updated_at: nowIso }).eq("group_id", context.group.id).in("id", expiredIds).eq("status", "open"),
        supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).in("side_bet_id", expiredIds).eq("response", "pending")
      ]);
      const expired = new Set(expiredIds);
      allSideBets = allSideBets.map((bet: any) => expired.has(bet.id) ? { ...bet, status: "expired" } : bet);
    }

    const profiles = context.members;
    const lockedByWeek = new Map<number, any[]>();
    for (const pick of lockedResult.data || []) {
      const pickWeek = Number(pick.week);
      const rows = lockedByWeek.get(pickWeek);
      if (rows) rows.push(pick);
      else lockedByWeek.set(pickWeek, [pick]);
    }
    const weeklyStandingsByWeek = Object.fromEntries(
      standingsWeeks.map((standingWeek) => [String(standingWeek), computeGroupStandings(profiles, lockedByWeek.get(standingWeek) || [], context.rules)])
    );
    const standings = computeGroupStandings(profiles, (lockedResult.data || []) as any, context.rules);
    const visiblePicks = (picksResult.data || []).map((pick: any) => ({ ...pick, game: gameById.get(pick.game_id) || pick.game }));
    const dismissedSideBetIds = new Set((sideBetDismissalResult.data || []).map((row: any) => row.side_bet_id));
    const sideBets = allSideBets.filter((bet: any) =>
      Number(bet.week) === week &&
      !dismissedSideBetIds.has(bet.id) &&
      (bet.creator_id === auth.profile.id || bet.accepted_by === auth.profile.id || bet.targets?.some((target: any) => target.recipient_id === auth.profile.id))
    );
    const rawSideBetSlotCounts = sideBetSlotCounts(allSideBets.filter((bet: any) => Number(bet.week) === week), profiles.map((profile) => profile.id));
    const sideBetSlotCountsByPlayer = Number.isFinite(sideBetSettings.maxPerWeek)
      ? rawSideBetSlotCounts
      : Object.fromEntries(profiles.map((profile) => [profile.id, 0]));
    const sideBetBankTotals = Object.fromEntries(profiles.map((profile) => [profile.id, 0]));
    for (const bet of allSideBets) {
      if (bet.status !== "settled" || bet.result === "push" || !bet.accepted_by || !bet.winner_id) continue;
      const loserId = bet.winner_id === bet.creator_id ? bet.accepted_by : bet.creator_id;
      sideBetBankTotals[bet.winner_id] = Number(sideBetBankTotals[bet.winner_id] || 0) + Number(bet.amount);
      sideBetBankTotals[loserId] = Number(sideBetBankTotals[loserId] || 0) - Number(bet.amount);
    }
    const weeklyBank = context.rules?.weeklyBank || {};
    const moneyAdmin = context.group.slug === "other-family"
      ? context.members.find((member) => member.display_name.toLowerCase() === "caleb") || null
      : null;

    return NextResponse.json({
      ok: true,
      currentUser: auth.profile,
      currentGroupRole: context.group.role,
      activeGroup: context.group,
      seasonYear: context.seasonYear,
      groupRules: context.rules,
      sideBetSettings: {
        enabled: sideBetSettings.enabled,
        maxAmount: Number.isFinite(sideBetSettings.maxAmount) ? sideBetSettings.maxAmount : null,
        maxPerWeek: Number.isFinite(sideBetSettings.maxPerWeek) ? sideBetSettings.maxPerWeek : null,
        manualAmount: context.rules?.sideBets?.amountEntry === "free"
      },
      profiles,
      games,
      picks: visiblePicks,
      standings,
      weeklyStandingsByWeek,
      bankSettings: {
        id: 1,
        winner_amount: Number(weeklyBank.lastPaysWinner ?? 20),
        loser_amount: Number(weeklyBank.secondPaysWinner ?? 10)
      },
      groupMoney: {
        weeklyAmount: Number(weekMoneyResult.data?.winner_take_all_amount || 0),
        seasonAmount: Number(seasonMoneyResult.data?.winner_take_all_amount || 0),
        weeklySubmitted: Boolean(weekMoneyResult.data?.submitted_at),
        seasonSubmitted: Boolean(seasonMoneyResult.data?.submitted_at),
        canEdit: Boolean(moneyAdmin && moneyAdmin.id === auth.profile.id),
        managerName: moneyAdmin?.display_name || null
      },
      bankEntries: bankResult.data || [],
      sideBets,
      sideBetSlotCounts: sideBetSlotCountsByPlayer,
      sideBetBankTotals,
      week,
      weekRule: getGroupWeekRule(context, week),
      weekOpenTime: weekOpen ? weekOpen.toISOString() : null,
      availableWeeks: standingsWeeks
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
