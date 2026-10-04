import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { fetchEspnEvent, fetchEspnSchedule } from "@/lib/espnSchedule";
import { actionMarketAvailable, fetchActionNetworkMarketForGame } from "@/lib/actionNetworkMarkets";
import { getGroupSideBetSettings, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { createNotificationInBackground, resolveSideBetOfferNotifications } from "@/lib/notifications";
import { MAX_CUSTOM_SIDE_BET_AMOUNT, sideBetSlotCounts } from "@/lib/sideBetLimits";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { americanOddsText, oppositeAmericanOdds, oppositeTotalSide, profitForRisk, validAmericanOdds } from "@/lib/sideBetMarkets";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { notificationTeamName } from "@/lib/notificationTeamName";

const viewWeek = z.number().int().nonnegative().optional();
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    gameId: z.string().min(1),
    creatorTeam: z.string().min(1),
    amount: z.number().positive(),
    recipientIds: z.array(z.string().uuid()).min(1).max(10),
    marketType: z.enum(["spread", "moneyline", "total"]).optional(),
    offerPhase: z.enum(["pregame", "live"]).optional(),
    creatorSpread: z.number().finite().min(-100).max(100).optional(),
    totalPoints: z.number().finite().min(0).max(200).optional(),
    creatorOdds: z.number().int().optional(),
    visibleLiveHomeScore: z.number().int().nonnegative().optional(),
    visibleLiveAwayScore: z.number().int().nonnegative().optional(),
    viewWeek
  }),
  z.object({
    action: z.literal("accept"),
    sideBetId: z.string().uuid(),
    visibleLiveHomeScore: z.number().int().nonnegative().optional(),
    visibleLiveAwayScore: z.number().int().nonnegative().optional(),
    viewWeek
  }),
  z.object({ action: z.literal("decline"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("cancel"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("clear"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({
    action: z.literal("expireLiveScores"),
    offers: z.array(z.object({
      sideBetId: z.string().uuid(),
      visibleLiveHomeScore: z.number().int().nonnegative(),
      visibleLiveAwayScore: z.number().int().nonnegative()
    })).min(1).max(20),
    viewWeek
  })
]);

export const dynamic = "force-dynamic";
export const revalidate = 0;

function notificationSpread(value: number) {
  if (value === 0) return "Pick'em";
  return value > 0 ? `+${value}` : String(value);
}

function notificationMarketText(
  team: string,
  league: string | null | undefined,
  marketType: "spread" | "moneyline" | "total",
  spread: number,
  odds: number,
  totalPoints?: number | null,
  totalSide?: "over" | "under" | null,
  awayTeam?: string | null,
  homeTeam?: string | null
) {
  const line = marketType === "moneyline"
    ? "ML"
    : marketType === "total"
      ? `${totalSide === "under" ? "U" : "O"} ${Number(totalPoints)}`
      : notificationSpread(spread);
  const oddsText = Math.abs(Number(odds)) === 100 ? "" : ` ${americanOddsText(odds)}`;
  if (marketType === "total" && awayTeam && homeTeam) {
    return `${notificationTeamName(awayTeam, league)} at ${notificationTeamName(homeTeam, league)} ${line}${oddsText}`;
  }
  return `${notificationTeamName(team, league)} ${line}${oddsText}`;
}

function notificationMoney(value: number) {
  const rounded = Math.round(Number(value) * 100) / 100;
  return `${rounded.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function notificationStakeText(risk: number, win: number) {
  return Math.abs(risk - win) < 0.005
    ? notificationMoney(risk)
    : `Risk ${notificationMoney(risk)} to win ${notificationMoney(win)}`;
}

function groupNotificationUrl(slug: string, destination: string) {
  const base = slug === "friends" ? "/friends" : slug === "other-family" ? "/caleb-family" : "/";
  return `${base}?notification=${encodeURIComponent(destination)}`;
}

type LiveScoreSnapshot = { home: number; away: number; completed: boolean };

function scoreNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

function storedLiveScore(game: any): LiveScoreSnapshot | null {
  const home = scoreNumber(game?.live_home_score);
  const away = scoreNumber(game?.live_away_score);
  if (home == null || away == null) return null;
  return {
    home,
    away,
    completed: Boolean(game?.live_completed || (game?.final_home_score != null && game?.final_away_score != null))
  };
}

async function currentLiveScore(game: any, freshness: boolean | number = true): Promise<LiveScoreSnapshot | null> {
  if (game?.espn_event_id && (game?.league === "CFB" || game?.league === "NFL")) {
    try {
      const event = await fetchEspnEvent(game.league, game.espn_event_id, freshness);
      if (event?.homeScore != null && event?.awayScore != null) {
        return { home: Number(event.homeScore), away: Number(event.awayScore), completed: Boolean(event.completed) };
      }
    } catch {
      // Keep the offer alive when the live-score provider has a brief interruption.
    }
  }
  return storedLiveScore(game);
}

async function scoreboardLiveScore(game: any, freshness: boolean | number = true): Promise<LiveScoreSnapshot | null> {
  if (!game?.espn_event_id || (game?.league !== "CFB" && game?.league !== "NFL")) return null;
  try {
    const schedule = await fetchEspnSchedule(game.league, [game.commence_time], freshness, 0);
    const event = schedule.find((candidate) => String(candidate.id) === String(game.espn_event_id));
    if (event?.homeScore == null || event?.awayScore == null) return null;
    return {
      home: Number(event.homeScore),
      away: Number(event.awayScore),
      completed: Boolean(event.completed)
    };
  } catch {
    return null;
  }
}

function liveScoreSnapshotStable(summaryScore: LiveScoreSnapshot | null, scoreboardScore: LiveScoreSnapshot | null) {
  return Boolean(
    summaryScore &&
    scoreboardScore &&
    summaryScore.home === scoreboardScore.home &&
    summaryScore.away === scoreboardScore.away
  );
}

function liveScoreDiffersFromOffer(bet: any, score: LiveScoreSnapshot | null) {
  if (!score) return false;
  const sentHome = scoreNumber(bet?.live_offer_home_score);
  const sentAway = scoreNumber(bet?.live_offer_away_score);
  if (sentHome == null || sentAway == null) return false;
  return score.home !== sentHome || score.away !== sentAway;
}

function liveScoreMatches(score: LiveScoreSnapshot | null, home: number, away: number) {
  return Boolean(score && score.home === home && score.away === away);
}

function liveScoreConfirmedByEither(
  summaryScore: LiveScoreSnapshot | null,
  scoreboardScore: LiveScoreSnapshot | null,
  home: number,
  away: number
) {
  return liveScoreMatches(summaryScore, home, away) || liveScoreMatches(scoreboardScore, home, away);
}

function liveScoreConsensus(
  summaryScore: LiveScoreSnapshot | null,
  scoreboardScore: LiveScoreSnapshot | null
): LiveScoreSnapshot | null {
  if (!summaryScore || !scoreboardScore) return null;
  return summaryScore.home === scoreboardScore.home && summaryScore.away === scoreboardScore.away
    ? summaryScore
    : null;
}

async function allGroupBets(supabase: any, groupId: string, seasonYear: number, week?: number) {
  let query = supabase
    .from("side_bets")
    .select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))")
    .eq("group_id", groupId)
    .eq("season_year", seasonYear);
  if (week != null) query = query.eq("week", week);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function dismissedSideBetIds(supabase: any, groupId: string, profileId: string) {
  const { data, error } = await supabase
    .from("side_bet_dismissals")
    .select("side_bet_id")
    .eq("group_id", groupId)
    .eq("user_id", profileId);
  if (error) throw new Error(error.message);
  return new Set((data || []).map((row: any) => row.side_bet_id));
}

async function expireOpenSideBets(supabase: any, groupId: string, ids: string[], nowIso: string) {
  if (!ids.length) return;
  await Promise.all([
    supabase.from("side_bets").update({ status: "expired", updated_at: nowIso }).eq("group_id", groupId).in("id", ids).eq("status", "open"),
    supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).in("side_bet_id", ids).eq("response", "pending")
  ]);
  await resolveSideBetOfferNotifications(supabase, ids, undefined, groupId);
}

async function snapshot(supabase: any, context: any, profileId: string, week: number) {
  let rows = await allGroupBets(supabase, context.group.id, context.seasonYear, week);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiredIds: string[] = [];

  for (const bet of rows) {
    if (bet.status !== "open" || !bet.game) continue;
    const phase = bet.offer_phase === "live" ? "live" : "pregame";
    if (phase === "pregame") {
      if (new Date(bet.game.commence_time) <= now) expiredIds.push(bet.id);
      continue;
    }

    // Live offers are intentionally not expired by background ESPN polling.
    // They stay open until the score shown in the app changes and the client
    // asks the server to verify that exact new score. A finalized game is the
    // only server-side exception.
    if (bet.game.final_home_score != null && bet.game.final_away_score != null) {
      expiredIds.push(bet.id);
    }
  }

  if (expiredIds.length) {
    await expireOpenSideBets(supabase, context.group.id, expiredIds, nowIso);
    const expired = new Set(expiredIds);
    rows = rows.map((bet: any) => expired.has(bet.id) ? { ...bet, status: "expired" } : bet);
  }

  const settings = getGroupSideBetSettings(context);
  const rawCounts = sideBetSlotCounts(rows, context.members.map((member: any) => member.id));
  const dismissed = await dismissedSideBetIds(supabase, context.group.id, profileId);
  return {
    sideBets: rows.filter((bet: any) => !dismissed.has(bet.id) && (bet.creator_id === profileId || bet.accepted_by === profileId || bet.targets?.some((target: any) => target.recipient_id === profileId))),
    sideBetSlotCounts: Number.isFinite(settings.maxPerWeek)
      ? rawCounts
      : Object.fromEntries(context.members.map((member: any) => [member.id, 0]))
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const parsedWeek = z.coerce.number().int().nonnegative().safeParse(req.nextUrl.searchParams.get("week"));
    if (!parsedWeek.success) return NextResponse.json({ ok: false, error: "A valid week is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const settings = getGroupSideBetSettings(context);
    if (!settings.enabled) return NextResponse.json({ ok: true, sideBets: [], sideBetSlotCounts: {} }, { headers: { "Cache-Control": "no-store, max-age=0" } });

    return NextResponse.json(
      { ok: true, ...(await snapshot(supabase, context, auth.profile.id, parsedWeek.data)) },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const settings = getGroupSideBetSettings(context);
    if (!settings.enabled) return NextResponse.json({ ok: false, error: "Side bets are disabled for this Pick'em group." }, { status: 409 });
    const now = new Date();
    const nowIso = now.toISOString();

    if (body.action === "create") {
      if (context.rules?.sideBets?.amountEntry === "fixed" && ![5, 10, 15, 20].includes(Number(body.amount))) {
        return NextResponse.json({ ok: false, error: "Choose a side bet amount of $20, $15, $10, or $5." }, { status: 409 });
      }
      const amountCap = context.rules?.sideBets?.amountEntry === "free" ? MAX_CUSTOM_SIDE_BET_AMOUNT : settings.maxAmount;
      if (Number.isFinite(amountCap) && Number(body.amount) > amountCap) {
        return NextResponse.json({ ok: false, error: `Side bets are capped at $${amountCap}.` }, { status: 409 });
      }
      const memberIds = new Set(context.members.map((member) => member.id));
      const recipientIds = Array.from(new Set(body.recipientIds)).filter((id) => id !== auth.profile.id && memberIds.has(id));
      if (!recipientIds.length) return NextResponse.json({ ok: false, error: "Choose at least one other player in this group." }, { status: 400 });

      const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", body.gameId).maybeSingle();
      if (gameError || !game) return NextResponse.json({ ok: false, error: "Game not found." }, { status: 404 });
      if (!isGameAllowedForGroup(context, game)) return NextResponse.json({ ok: false, error: "That game is not available in this Pick'em group." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(body.creatorTeam)) return NextResponse.json({ ok: false, error: "Choose one of the two teams in this game." }, { status: 400 });

      const offerPhase = body.offerPhase === "live" ? "live" : "pregame";
      const marketType = body.marketType || "spread";
      const kickoffReached = new Date(game.commence_time) <= now;
      const [sentLiveScore, sentScoreboardScore] = offerPhase === "live"
        ? await Promise.all([currentLiveScore(game, true), scoreboardLiveScore(game)])
        : [null, null];
      const visibleLiveScore = offerPhase === "live" &&
        body.visibleLiveHomeScore != null &&
        body.visibleLiveAwayScore != null
        ? { home: body.visibleLiveHomeScore, away: body.visibleLiveAwayScore }
        : null;
      const gameFinal = Boolean(
        sentLiveScore?.completed ||
        sentScoreboardScore?.completed ||
        game.live_completed ||
        (game.final_home_score != null && game.final_away_score != null)
      );
      if (offerPhase === "pregame" && kickoffReached) {
        return NextResponse.json({ ok: false, error: "Pregame offers expire at kickoff. Create a new live offer instead." }, { status: 409 });
      }
      if (offerPhase === "live" && !kickoffReached) {
        return NextResponse.json({ ok: false, error: "Live offers are available after kickoff." }, { status: 409 });
      }
      if (offerPhase === "live" && gameFinal) {
        return NextResponse.json({ ok: false, error: "This game is final." }, { status: 409 });
      }
      if (offerPhase === "live" && visibleLiveScore) {
        if (!liveScoreConfirmedByEither(sentLiveScore, sentScoreboardScore, visibleLiveScore.home, visibleLiveScore.away)) {
          const consensus = liveScoreConsensus(sentLiveScore, sentScoreboardScore);
          if (consensus && !liveScoreMatches(consensus, visibleLiveScore.home, visibleLiveScore.away)) {
            return NextResponse.json({ ok: false, error: "The live score changed while you were sending the offer. Try again with the current score." }, { status: 409 });
          }
          return NextResponse.json({ ok: false, error: "The live score is updating. Try the offer again in a moment." }, { status: 409 });
        }
      } else if (offerPhase === "live" && !sentLiveScore && !sentScoreboardScore) {
        return NextResponse.json({ ok: false, error: "The live score is still loading. Try the offer again in a moment." }, { status: 409 });
      }

      const currentMarket = await fetchActionNetworkMarketForGame(game, offerPhase);
      if (!actionMarketAvailable(currentMarket, marketType)) {
        return NextResponse.json({ ok: false, error: offerPhase === "live" ? "The live market is currently unavailable or suspended." : "That market is currently unavailable." }, { status: 409 });
      }

      const creatorOdds = body.creatorOdds ?? 100;
      if (!validAmericanOdds(creatorOdds)) {
        return NextResponse.json({ ok: false, error: "American odds must be -100 or lower, or +100 or higher." }, { status: 400 });
      }
      const currentCreatorSpread = normalizeSpreadForSelectedTeam(body.creatorTeam, game.current_spread_team, game.current_spread);
      const creatorSpread = marketType === "spread" ? (body.creatorSpread ?? currentCreatorSpread) : 0;
      if (marketType === "spread" && creatorSpread == null) {
        return NextResponse.json({ ok: false, error: "Choose a spread for this side bet." }, { status: 409 });
      }
      const totalPoints = marketType === "total" ? Number(body.totalPoints) : null;
      if (marketType === "total" && (!Number.isFinite(totalPoints) || Number(totalPoints) <= 0)) {
        return NextResponse.json({ ok: false, error: "Choose a total for this side bet." }, { status: 409 });
      }
      const creatorTotalSide = marketType === "total"
        ? (body.creatorTeam === game.away_team ? "over" : "under")
        : null;
      const resolvedCreatorSpread = Number(creatorSpread ?? 0);

      if (Number.isFinite(settings.maxPerWeek)) {
        const rows = await allGroupBets(supabase, context.group.id, context.seasonYear, Number(game.week));
        const counts = sideBetSlotCounts(rows, context.members.map((member) => member.id));
        if ((counts[auth.profile.id] || 0) >= settings.maxPerWeek) {
          return NextResponse.json({ ok: false, error: `You already have ${settings.maxPerWeek} accepted or pending side bets this week.` }, { status: 409 });
        }
        const fullRecipientId = recipientIds.find((id) => (counts[id] || 0) >= settings.maxPerWeek);
        if (fullRecipientId) {
          return NextResponse.json({ ok: false, error: `${context.members.find((member) => member.id === fullRecipientId)?.display_name || "That player"} has reached the weekly side bet limit.` }, { status: 409 });
        }
      }

      const offeredTeam = body.creatorTeam === game.home_team ? game.away_team : game.home_team;
      const offeredSpread = marketType === "spread" ? -resolvedCreatorSpread : 0;
      const offeredTotalSide = creatorTotalSide ? oppositeTotalSide(creatorTotalSide) : null;
      const appOfferedSpread = marketType === "spread"
        ? normalizeSpreadForSelectedTeam(offeredTeam, game.current_spread_team, game.current_spread)
        : null;
      const marketReference = offerPhase === "pregame" && appOfferedSpread != null && Math.abs(offeredSpread - appOfferedSpread) >= 0.001
        ? ` · Market ${notificationTeamName(offeredTeam, game.league)} ${notificationSpread(appOfferedSpread)}`
        : "";
      const amount = Math.round(Number(body.amount) * 100) / 100;
      const { data: sideBet, error: insertError } = await supabase.from("side_bets").insert({
        group_id: context.group.id,
        season_year: context.seasonYear,
        creator_id: auth.profile.id,
        game_id: game.id,
        week: game.week,
        creator_team: body.creatorTeam,
        offered_team: offeredTeam,
        creator_spread: resolvedCreatorSpread,
        offered_spread: offeredSpread,
        market_type: marketType,
        offer_phase: offerPhase,
        total_points: totalPoints,
        creator_total_side: creatorTotalSide,
        creator_odds: creatorOdds,
        live_offer_home_score: visibleLiveScore?.home ?? sentLiveScore?.home ?? sentScoreboardScore?.home ?? null,
        live_offer_away_score: visibleLiveScore?.away ?? sentLiveScore?.away ?? sentScoreboardScore?.away ?? null,
        amount,
        status: "open",
        result: "pending"
      }).select("*").single();
      if (insertError) throw new Error(insertError.message);

      const targetResult = await supabase.from("side_bet_targets").insert(recipientIds.map((recipientId) => ({ side_bet_id: sideBet.id, recipient_id: recipientId })));
      if (targetResult.error) {
        await supabase.from("side_bets").delete().eq("id", sideBet.id).eq("group_id", context.group.id);
        throw new Error(targetResult.error.message);
      }

      recipientIds.forEach((recipientId) => createNotificationInBackground(supabase, {
          groupId: context.group.id,
          userId: recipientId,
          type: "side_bet_offer",
          destination: "side_bets_received",
          entityId: sideBet.id,
          dedupeKey: `side-bet-offer:${sideBet.id}`,
          title: `Side bet from ${auth.profile.display_name}`,
          body: `${notificationStakeText(profitForRisk(amount, creatorOdds), amount)} · ${notificationMarketText(offeredTeam, game.league, marketType, offeredSpread, oppositeAmericanOdds(creatorOdds), totalPoints, offeredTotalSide, game.away_team, game.home_team)}${marketReference}`,
          url: groupNotificationUrl(context.group.slug, "side_bets_received"),
          actionRequired: true
        }));
      const nextSnapshot = await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? Number(game.week));
      return NextResponse.json({ ok: true, sideBet, ...nextSnapshot });
    }

    if (body.action === "expireLiveScores") {
      const requested = new Map(body.offers.map((offer) => [offer.sideBetId, offer]));
      const offerIds = Array.from(requested.keys());
      const { data: liveOffers, error: liveOffersError } = await supabase
        .from("side_bets")
        .select("*, game:games(*), targets:side_bet_targets(*)")
        .eq("group_id", context.group.id)
        .eq("season_year", context.seasonYear)
        .in("id", offerIds);
      if (liveOffersError) throw new Error(liveOffersError.message);

      const scoreChecks = new Map<string, Promise<[LiveScoreSnapshot | null, LiveScoreSnapshot | null]>>();
      const expireIds: string[] = [];

      for (const bet of liveOffers || []) {
        const visible = requested.get(bet.id);
        if (!visible || bet.status !== "open" || bet.offer_phase !== "live" || !bet.game) continue;
        const target = bet.targets?.find((row: any) => row.recipient_id === auth.profile.id);
        if (bet.creator_id !== auth.profile.id && !target) continue;

        const visibleScore: LiveScoreSnapshot = {
          home: visible.visibleLiveHomeScore,
          away: visible.visibleLiveAwayScore,
          completed: false
        };
        if (!liveScoreDiffersFromOffer(bet, visibleScore)) continue;

        if (bet.game.final_home_score != null && bet.game.final_away_score != null) {
          expireIds.push(bet.id);
          continue;
        }

        if (!scoreChecks.has(bet.game.id)) {
          scoreChecks.set(bet.game.id, Promise.all([
            currentLiveScore(bet.game, 4),
            scoreboardLiveScore(bet.game, 4)
          ]));
        }
        const [summaryScore, scoreboardScore] = await scoreChecks.get(bet.game.id)!;
        if (!liveScoreConfirmedByEither(summaryScore, scoreboardScore, visible.visibleLiveHomeScore, visible.visibleLiveAwayScore)) continue;
        expireIds.push(bet.id);
      }

      if (expireIds.length) {
        await expireOpenSideBets(supabase, context.group.id, Array.from(new Set(expireIds)), nowIso);
      }
      const fallbackWeek = Number((liveOffers || [])[0]?.week ?? 0);
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? fallbackWeek)) });
    }

    const { data: sideBet, error: sideBetError } = await supabase
      .from("side_bets")
      .select("*, game:games(*), targets:side_bet_targets(*)")
      .eq("group_id", context.group.id)
      .eq("season_year", context.seasonYear)
      .eq("id", body.sideBetId)
      .maybeSingle();
    if (sideBetError || !sideBet) return NextResponse.json({ ok: false, error: "Side bet not found in this group." }, { status: 404 });
    const target = sideBet.targets?.find((row: any) => row.recipient_id === auth.profile.id);

    if (body.action === "clear") {
      const isCreator = sideBet.creator_id === auth.profile.id;
      const canClear = isCreator
        ? ["declined", "cancelled"].includes(sideBet.status)
        : Boolean(target && (target.response === "declined" || sideBet.status === "cancelled"));
      if (!canClear) return NextResponse.json({ ok: false, error: "Only declined or cancelled offers can be cleared." }, { status: 409 });
      const { error: dismissError } = await supabase.from("side_bet_dismissals").upsert({
        side_bet_id: sideBet.id,
        user_id: auth.profile.id,
        group_id: context.group.id,
        created_at: nowIso
      }, { onConflict: "side_bet_id,user_id,group_id" });
      if (dismissError) throw new Error(dismissError.message);
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }

    if (body.action === "cancel") {
      if (sideBet.creator_id !== auth.profile.id) return NextResponse.json({ ok: false, error: "Only the sender can cancel this offer." }, { status: 403 });
      if (sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer open." }, { status: 409 });
      const { data: cancelled, error: cancelError } = await supabase
        .from("side_bets")
        .update({ status: "cancelled", updated_at: nowIso })
        .eq("group_id", context.group.id)
        .eq("id", sideBet.id)
        .eq("status", "open")
        .select("id")
        .maybeSingle();
      if (cancelError) throw new Error(cancelError.message);
      if (!cancelled) return NextResponse.json({ ok: false, error: "This offer is no longer open." }, { status: 409 });
      const { error: closeTargetsError } = await supabase
        .from("side_bet_targets")
        .update({ response: "closed", responded_at: nowIso })
        .eq("side_bet_id", sideBet.id)
        .eq("response", "pending");
      if (closeTargetsError) throw new Error(closeTargetsError.message);
      await resolveSideBetOfferNotifications(supabase, [sideBet.id], undefined, context.group.id);
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }

    if (!target) return NextResponse.json({ ok: false, error: "This offer was not sent to you." }, { status: 403 });
    if (body.action === "accept" && sideBet.status === "accepted" && sideBet.accepted_by === auth.profile.id) {
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }
    if (body.action === "decline" && target.response === "declined") {
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }
    if (target.response !== "pending" || sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer available." }, { status: 409 });
    if (!sideBet.game) return NextResponse.json({ ok: false, error: "Game unavailable." }, { status: 409 });
    const sideBetPhase = sideBet.offer_phase === "live" ? "live" : "pregame";
    const [acceptLiveScore, acceptScoreboardScore] = sideBetPhase === "live"
      ? await Promise.all([currentLiveScore(sideBet.game, 4), scoreboardLiveScore(sideBet.game, 4)])
      : [null, null];
    const sideBetGameFinal = Boolean(
      acceptLiveScore?.completed ||
      acceptScoreboardScore?.completed ||
      sideBet.game.live_completed ||
      (sideBet.game.final_home_score != null && sideBet.game.final_away_score != null)
    );
    if (sideBetPhase === "pregame" && new Date(sideBet.game.commence_time) <= now) {
      return NextResponse.json({ ok: false, error: "Kickoff has passed. This pregame offer expired." }, { status: 409 });
    }
    if (sideBetPhase === "live" && sideBetGameFinal) {
      await expireOpenSideBets(supabase, context.group.id, [sideBet.id], nowIso);
      return NextResponse.json({ ok: false, error: "This game is final." }, { status: 409 });
    }
    if (sideBetPhase === "live" && body.action === "accept") {
      const sentHome = scoreNumber(sideBet.live_offer_home_score);
      const sentAway = scoreNumber(sideBet.live_offer_away_score);
      if (sentHome == null || sentAway == null) {
        return NextResponse.json({ ok: false, error: "The live score is updating. This offer is still active; try accepting again in a moment." }, { status: 409 });
      }

      const visibleProvided = body.visibleLiveHomeScore != null && body.visibleLiveAwayScore != null;
      if (visibleProvided) {
        const visibleScore: LiveScoreSnapshot = {
          home: Number(body.visibleLiveHomeScore),
          away: Number(body.visibleLiveAwayScore),
          completed: false
        };
        if (liveScoreDiffersFromOffer(sideBet, visibleScore)) {
          if (liveScoreConfirmedByEither(acceptLiveScore, acceptScoreboardScore, visibleScore.home, visibleScore.away)) {
            await expireOpenSideBets(supabase, context.group.id, [sideBet.id], nowIso);
            return NextResponse.json({ ok: false, error: "The score changed after this live offer was sent, so the offer expired." }, { status: 409 });
          }
          return NextResponse.json({ ok: false, error: "The live score is updating. This offer is still active; try accepting again in a moment." }, { status: 409 });
        }
      }

      // Accept while at least one fresh ESPN path still confirms the offer
      // score. A temporary mismatch between scoreboard and summary no longer
      // makes every live bet unusable during normal provider propagation.
      if (!liveScoreConfirmedByEither(acceptLiveScore, acceptScoreboardScore, sentHome, sentAway)) {
        return NextResponse.json({ ok: false, error: "The live score is updating. This offer is still active; try accepting again in a moment." }, { status: 409 });
      }
    }

    if (body.action === "decline") {
      const result = await supabase.from("side_bet_targets").update({ response: "declined", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id).eq("response", "pending");
      if (result.error) throw new Error(result.error.message);
      const { count } = await supabase.from("side_bet_targets").select("recipient_id", { count: "exact", head: true }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      if (!count) await supabase.from("side_bets").update({ status: "declined", updated_at: nowIso }).eq("group_id", context.group.id).eq("id", sideBet.id).eq("status", "open");
      await resolveSideBetOfferNotifications(supabase, [sideBet.id], auth.profile.id, context.group.id);
      createNotificationInBackground(supabase, {
          groupId: context.group.id,
          userId: sideBet.creator_id,
          type: "side_bet_response",
          destination: "side_bets_sent",
          entityId: sideBet.id,
          dedupeKey: `side-bet-declined:${sideBet.id}:${auth.profile.id}`,
          title: `${auth.profile.display_name} declined your side bet`,
          body: notificationMarketText(
            sideBet.offered_team,
            sideBet.game?.league,
            sideBet.market_type === "moneyline" ? "moneyline" : sideBet.market_type === "total" ? "total" : "spread",
            Number(sideBet.offered_spread),
            oppositeAmericanOdds(Number(sideBet.creator_odds ?? 100)),
            sideBet.total_points == null ? null : Number(sideBet.total_points),
            sideBet.creator_total_side ? oppositeTotalSide(sideBet.creator_total_side) : null,
            sideBet.game?.away_team,
            sideBet.game?.home_team
          ),
          url: groupNotificationUrl(context.group.slug, "side_bets_sent")
        });
      const nextSnapshot = await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week);
      return NextResponse.json({ ok: true, ...nextSnapshot });
    }

    if (Number.isFinite(settings.maxPerWeek)) {
      const rows = await allGroupBets(supabase, context.group.id, context.seasonYear, Number(sideBet.week));
      const counts = sideBetSlotCounts(rows, context.members.map((member) => member.id), sideBet.id);
      if ((counts[auth.profile.id] || 0) >= settings.maxPerWeek || (counts[sideBet.creator_id] || 0) >= settings.maxPerWeek) {
        return NextResponse.json({ ok: false, error: "A player has reached the weekly side bet limit." }, { status: 409 });
      }
    }

    const { data: accepted, error: acceptError } = await supabase.from("side_bets").update({
      status: "accepted",
      accepted_by: auth.profile.id,
      accepted_at: nowIso,
      updated_at: nowIso
    }).eq("group_id", context.group.id).eq("id", sideBet.id).eq("status", "open").select("id").maybeSingle();
    if (acceptError) throw new Error(acceptError.message);
    if (!accepted) {
      const { data: current } = await supabase.from("side_bets").select("status,accepted_by").eq("group_id", context.group.id).eq("id", sideBet.id).maybeSingle();
      if (current?.status === "accepted" && current.accepted_by === auth.profile.id) {
        return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
      }
      return NextResponse.json({ ok: false, error: "This offer was accepted before you could accept it." }, { status: 409 });
    }

    await Promise.all([
      supabase.from("side_bet_targets").update({ response: "accepted", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id),
      supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).neq("recipient_id", auth.profile.id).eq("response", "pending")
    ]);
    await resolveSideBetOfferNotifications(supabase, [sideBet.id], undefined, context.group.id);
    createNotificationInBackground(supabase, {
        groupId: context.group.id,
        userId: sideBet.creator_id,
        type: "side_bet_response",
        destination: "side_bets_sent",
        entityId: sideBet.id,
        dedupeKey: `side-bet-accepted:${sideBet.id}`,
        title: `${auth.profile.display_name} accepted your side bet`,
        body: `${notificationStakeText(Number(sideBet.amount), profitForRisk(Number(sideBet.amount), Number(sideBet.creator_odds ?? 100)))} · ${notificationMarketText(
          sideBet.creator_team,
          sideBet.game?.league,
          sideBet.market_type === "moneyline" ? "moneyline" : sideBet.market_type === "total" ? "total" : "spread",
          Number(sideBet.creator_spread),
          Number(sideBet.creator_odds ?? 100),
          sideBet.total_points == null ? null : Number(sideBet.total_points),
          sideBet.creator_total_side,
          sideBet.game?.away_team,
          sideBet.game?.home_team
        )}`,
        url: groupNotificationUrl(context.group.slug, "side_bets_sent")
      });
    const nextSnapshot = await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week);
    return NextResponse.json({ ok: true, ...nextSnapshot });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
