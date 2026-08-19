import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getPickWeekOpenTime } from "@/lib/lockRules";
import { hasChargers, isEligibleSeasonGame } from "@/lib/seasonRules";
import { closeOpenOffersForCappedPlayer, getAcceptedSideBetCounts, getSideBetSlotCounts, MAX_SIDE_BETS_PER_WEEK, MAX_SIDE_BET_AMOUNT, sideBetSlotCounts } from "@/lib/sideBetLimits";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { createNotificationSafely, resolveSideBetOfferNotifications } from "@/lib/notifications";

const viewWeek = z.number().int().nonnegative().optional();
const createSchema = z.object({
  action: z.literal("create"),
  gameId: z.string().min(1),
  creatorTeam: z.string().min(1),
  amount: z.number().positive().max(MAX_SIDE_BET_AMOUNT),
  recipientIds: z.array(z.string().uuid()).min(1).max(2),
  viewWeek
});
const acceptSchema = z.object({ action: z.literal("accept"), sideBetId: z.string().uuid(), viewWeek });
const declineSchema = z.object({ action: z.literal("decline"), sideBetId: z.string().uuid(), viewWeek });
const cancelSchema = z.object({ action: z.literal("cancel"), sideBetId: z.string().uuid(), viewWeek });
const clearSchema = z.object({ action: z.literal("clear"), sideBetId: z.string().uuid(), viewWeek });
const bodySchema = z.discriminatedUnion("action", [createSchema, acceptSchema, declineSchema, cancelSchema, clearSchema]);

function weekOpenError(openTime: Date) {
  const openText = openTime.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago"
  });
  return `Side bet offers open on ${openText}.`;
}

function notificationSpread(value: number) {
  if (value === 0) return "Pick'em";
  return value > 0 ? `+${value}` : String(value);
}

async function sideBetSnapshot(supabase: any, profileId: string, week: number) {
  const { data, error } = await supabase
    .from("side_bets")
    .select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  let allSideBets = data || [];
  const nowIso = new Date().toISOString();
  const expiredIds = allSideBets
    .filter((bet: any) => bet.status === "open" && bet.game && new Date(bet.game.commence_time) <= new Date(nowIso))
    .map((bet: any) => bet.id);
  if (expiredIds.length) {
    const [{ error: betError }, { error: targetError }] = await Promise.all([
      supabase.from("side_bets").update({ status: "expired", updated_at: nowIso }).in("id", expiredIds).eq("status", "open"),
      supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).in("side_bet_id", expiredIds).eq("response", "pending")
    ]);
    if (betError) throw new Error(betError.message);
    if (targetError) throw new Error(targetError.message);
    await resolveSideBetOfferNotifications(supabase, expiredIds);
    const expiredSet = new Set(expiredIds);
    allSideBets = allSideBets.map((bet: any) => expiredSet.has(bet.id) ? {
      ...bet,
      status: "expired",
      targets: bet.targets?.map((target: any) => target.response === "pending" ? { ...target, response: "closed", responded_at: nowIso } : target)
    } : bet);
  }
  return {
    sideBets: allSideBets.filter((bet: any) =>
      bet.creator_id === profileId ||
      bet.accepted_by === profileId ||
      bet.targets?.some((target: any) => target.recipient_id === profileId)
    ),
    sideBetSlotCounts: sideBetSlotCounts(allSideBets.filter((bet: any) => bet.week === week))
  };
}

async function successResponse(
  supabase: any,
  profileId: string,
  week: number,
  extra: Record<string, unknown> = {},
  concurrentTasks: Promise<unknown>[] = []
) {
  // The response snapshot and non-critical notification delivery are independent.
  // Start them together so push delivery no longer sits in front of the UI refresh.
  const snapshotPromise = sideBetSnapshot(supabase, profileId, week);
  await Promise.all([snapshotPromise, ...concurrentTasks]);
  const snapshot = await snapshotPromise;
  return NextResponse.json({ ok: true, ...extra, ...snapshot });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const nowIso = now.toISOString();

    if (body.action === "create") {
      const recipientIds = Array.from(new Set(body.recipientIds)).filter((id) => id !== auth.profile.id);
      if (!recipientIds.length) return NextResponse.json({ ok: false, error: "Choose one or both of the other players." }, { status: 400 });

      // Game validation and recipient validation do not depend on each other.
      const [gameResult, recipientResult] = await Promise.all([
        supabase.from("games").select("*").eq("id", body.gameId).single(),
        supabase.from("profiles").select("id,display_name").in("id", recipientIds)
      ]);
      const { data: game, error: gameError } = gameResult;
      const { data: recipients, error: recipientError } = recipientResult;
      if (gameError || !game) return NextResponse.json({ ok: false, error: "Game not found." }, { status: 404 });
      if (recipientError) return NextResponse.json({ ok: false, error: recipientError.message }, { status: 500 });
      if (recipients?.length !== recipientIds.length) return NextResponse.json({ ok: false, error: "Choose one or both of the other players." }, { status: 400 });
      if (!isEligibleSeasonGame(game)) return NextResponse.json({ ok: false, error: "This game is not eligible for side bets." }, { status: 409 });
      if (hasChargers(game)) return NextResponse.json({ ok: false, error: "Chargers games are not available for side bets." }, { status: 409 });
      const weekOpen = getPickWeekOpenTime(game.week, [game.commence_time]);
      if (weekOpen && now < weekOpen) return NextResponse.json({ ok: false, error: weekOpenError(weekOpen) }, { status: 409 });
      if (new Date(game.commence_time) <= now) return NextResponse.json({ ok: false, error: "Side bets must be offered before kickoff." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(body.creatorTeam)) return NextResponse.json({ ok: false, error: "Choose one of the two teams in this game." }, { status: 400 });

      const creatorSpread = normalizeSpreadForSelectedTeam(body.creatorTeam, game.current_spread_team, game.current_spread);
      if (creatorSpread == null) return NextResponse.json({ ok: false, error: "This game does not have a spread available." }, { status: 409 });

      const slotCounts = await getSideBetSlotCounts(supabase, game.week, [auth.profile.id, ...recipientIds]);
      if ((slotCounts[auth.profile.id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
        return NextResponse.json({ ok: false, error: `You already have ${MAX_SIDE_BETS_PER_WEEK} accepted or pending side bets this week.` }, { status: 409 });
      }
      const fullRecipient = recipients?.find((recipient) => (slotCounts[recipient.id] || 0) >= MAX_SIDE_BETS_PER_WEEK);
      if (fullRecipient) {
        return NextResponse.json({ ok: false, error: `${fullRecipient.display_name} already has ${MAX_SIDE_BETS_PER_WEEK} accepted or pending side bets this week.` }, { status: 409 });
      }

      const offeredTeam = body.creatorTeam === game.home_team ? game.away_team : game.home_team;
      const amount = Math.round(body.amount * 100) / 100;
      const { data: sideBet, error: insertError } = await supabase.from("side_bets").insert({
        creator_id: auth.profile.id,
        game_id: game.id,
        week: game.week,
        creator_team: body.creatorTeam,
        offered_team: offeredTeam,
        creator_spread: creatorSpread,
        offered_spread: -creatorSpread,
        amount,
        status: "open",
        result: "pending"
      }).select("*").single();
      if (insertError) return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });

      const { error: targetError } = await supabase.from("side_bet_targets").insert(recipientIds.map((recipientId) => ({ side_bet_id: sideBet.id, recipient_id: recipientId })));
      if (targetError) {
        await supabase.from("side_bets").delete().eq("id", sideBet.id);
        return NextResponse.json({ ok: false, error: targetError.message }, { status: 500 });
      }
      const updatedSlotCounts = await getSideBetSlotCounts(supabase, game.week, [auth.profile.id, ...recipientIds]);
      const overLimit = [auth.profile.id, ...recipientIds].some((playerId) => (updatedSlotCounts[playerId] || 0) > MAX_SIDE_BETS_PER_WEEK);
      if (overLimit) {
        await supabase.from("side_bet_targets").delete().eq("side_bet_id", sideBet.id);
        await supabase.from("side_bets").delete().eq("id", sideBet.id);
        return NextResponse.json({ ok: false, error: "A player reached the weekly side bet limit before this offer was completed." }, { status: 409 });
      }

      const notificationTask = Promise.all(recipientIds.map((recipientId) => createNotificationSafely(supabase, {
        userId: recipientId,
        type: "side_bet_offer",
        destination: "side_bets_received",
        entityId: sideBet.id,
        dedupeKey: `side-bet-offer:${sideBet.id}`,
        title: `Side bet from ${auth.profile.display_name}`,
        body: `$${amount} · ${offeredTeam} ${notificationSpread(-creatorSpread)}`,
        url: "/?notification=side_bets_received",
        actionRequired: true
      })));
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? game.week, { sideBet }, [notificationTask]);
    }

    const { data: sideBet, error: sideBetError } = await supabase
      .from("side_bets")
      .select("*, game:games(*), targets:side_bet_targets(*)")
      .eq("id", body.sideBetId)
      .single();
    if (sideBetError || !sideBet) return NextResponse.json({ ok: false, error: "Side bet not found." }, { status: 404 });

    const target = sideBet.targets?.find((row: any) => row.recipient_id === auth.profile.id);

    if (body.action === "clear") {
      if (sideBet.creator_id === auth.profile.id) {
        if (!["declined", "cancelled"].includes(sideBet.status)) return NextResponse.json({ ok: false, error: "Only declined or cancelled offers can be cleared." }, { status: 409 });
        const { error: deleteError } = await supabase.from("side_bets").delete().eq("id", sideBet.id).eq("creator_id", auth.profile.id).in("status", ["declined", "cancelled"]);
        if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
        return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week);
      }
      if (!target || (target.response !== "declined" && sideBet.status !== "cancelled")) return NextResponse.json({ ok: false, error: "Only declined or cancelled offers can be cleared." }, { status: 409 });
      const { error: clearError } = await supabase.from("side_bet_targets").delete().eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id);
      if (clearError) return NextResponse.json({ ok: false, error: clearError.message }, { status: 500 });
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week);
    }

    if (body.action === "cancel") {
      if (sideBet.creator_id !== auth.profile.id) return NextResponse.json({ ok: false, error: "Only the sender can cancel this offer." }, { status: 403 });
      if (sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer open." }, { status: 409 });
      const { data: cancelled, error: cancelError } = await supabase.from("side_bets").update({ status: "cancelled", updated_at: nowIso }).eq("id", sideBet.id).eq("status", "open").select("id").maybeSingle();
      if (cancelError) return NextResponse.json({ ok: false, error: cancelError.message }, { status: 500 });
      if (!cancelled) return NextResponse.json({ ok: false, error: "This offer was accepted before it could be cancelled." }, { status: 409 });
      const { error: closeTargetError } = await supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      if (closeTargetError) return NextResponse.json({ ok: false, error: closeTargetError.message }, { status: 500 });
      const resolveTask = resolveSideBetOfferNotifications(supabase, [sideBet.id]);
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week, {}, [resolveTask]);
    }

    if (!target) return NextResponse.json({ ok: false, error: "This offer was not sent to you." }, { status: 403 });
    if (target.response !== "pending" || sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer available." }, { status: 409 });
    if (!sideBet.game || new Date(sideBet.game.commence_time) <= now) {
      const [{ error: expireError }, { error: closeTargetError }] = await Promise.all([
        supabase.from("side_bets").update({ status: "expired", updated_at: nowIso }).eq("id", sideBet.id).eq("status", "open"),
        supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending")
      ]);
      if (expireError) return NextResponse.json({ ok: false, error: expireError.message }, { status: 500 });
      if (closeTargetError) return NextResponse.json({ ok: false, error: closeTargetError.message }, { status: 500 });
      await resolveSideBetOfferNotifications(supabase, [sideBet.id]);
      return NextResponse.json({ ok: false, error: "Kickoff has passed. This offer expired." }, { status: 409 });
    }

    if (body.action === "decline") {
      const { error: declineError } = await supabase.from("side_bet_targets").update({ response: "declined", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id).eq("response", "pending");
      if (declineError) return NextResponse.json({ ok: false, error: declineError.message }, { status: 500 });

      const resolveTask = resolveSideBetOfferNotifications(supabase, [sideBet.id], auth.profile.id);
      const pendingTask = supabase.from("side_bet_targets").select("recipient_id", { count: "exact", head: true }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      const [, pendingResult] = await Promise.all([resolveTask, pendingTask]);
      if (pendingResult.error) return NextResponse.json({ ok: false, error: pendingResult.error.message }, { status: 500 });
      if (!pendingResult.count) {
        const { error: sideBetDeclineError } = await supabase.from("side_bets").update({ status: "declined", updated_at: nowIso }).eq("id", sideBet.id).eq("status", "open");
        if (sideBetDeclineError) return NextResponse.json({ ok: false, error: sideBetDeclineError.message }, { status: 500 });
      }

      const notificationTask = createNotificationSafely(supabase, {
        userId: sideBet.creator_id,
        type: "side_bet_response",
        destination: "side_bets_sent",
        entityId: sideBet.id,
        dedupeKey: `side-bet-response:${sideBet.id}:${auth.profile.id}:declined`,
        title: `${auth.profile.display_name} declined your side bet`,
        body: `$${Number(sideBet.amount)} · ${sideBet.creator_team} ${notificationSpread(Number(sideBet.creator_spread))}`,
        url: "/?notification=side_bets_sent"
      });
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week, {}, [notificationTask]);
    }

    const weekOpen = getPickWeekOpenTime(sideBet.week, [sideBet.game.commence_time]);
    if (weekOpen && now < weekOpen) {
      return NextResponse.json({ ok: false, error: weekOpenError(weekOpen) }, { status: 409 });
    }

    const otherSlotCounts = await getSideBetSlotCounts(supabase, sideBet.week, [auth.profile.id, sideBet.creator_id], sideBet.id);
    if ((otherSlotCounts[auth.profile.id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
      return NextResponse.json({ ok: false, error: `You already have ${MAX_SIDE_BETS_PER_WEEK} other accepted or pending side bets this week.` }, { status: 409 });
    }
    if ((otherSlotCounts[sideBet.creator_id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
      return NextResponse.json({ ok: false, error: "The sender has already reached the weekly side bet limit." }, { status: 409 });
    }

    const { data: accepted, error: acceptError } = await supabase.from("side_bets").update({
      status: "accepted",
      accepted_by: auth.profile.id,
      accepted_at: nowIso,
      updated_at: nowIso
    }).eq("id", sideBet.id).eq("status", "open").is("accepted_by", null).select("*").maybeSingle();
    if (acceptError) return NextResponse.json({ ok: false, error: acceptError.message }, { status: 500 });
    if (!accepted) return NextResponse.json({ ok: false, error: "Another player accepted this offer first." }, { status: 409 });

    const [closeTargetsResult, acceptTargetResult] = await Promise.all([
      supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending"),
      supabase.from("side_bet_targets").update({ response: "accepted", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id)
    ]);
    if (closeTargetsResult.error) return NextResponse.json({ ok: false, error: closeTargetsResult.error.message }, { status: 500 });
    if (acceptTargetResult.error) return NextResponse.json({ ok: false, error: acceptTargetResult.error.message }, { status: 500 });

    const resolveTask = resolveSideBetOfferNotifications(supabase, [sideBet.id]);
    const notificationTask = createNotificationSafely(supabase, {
      userId: sideBet.creator_id,
      type: "side_bet_response",
      destination: "side_bets_sent",
      entityId: sideBet.id,
      dedupeKey: `side-bet-response:${sideBet.id}:${auth.profile.id}:accepted`,
      title: `${auth.profile.display_name} accepted your side bet`,
      body: `$${Number(sideBet.amount)} · ${sideBet.creator_team} ${notificationSpread(Number(sideBet.creator_spread))}`,
      url: "/?notification=side_bets_sent"
    });
    const updatedCounts = await getAcceptedSideBetCounts(supabase, sideBet.week, [auth.profile.id, sideBet.creator_id]);
    await resolveTask;

    if ((updatedCounts[auth.profile.id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
      const closedOffers = await closeOpenOffersForCappedPlayer(supabase, auth.profile.id, sideBet.week, nowIso);
      await Promise.all([
        resolveSideBetOfferNotifications(supabase, closedOffers.outgoingIds),
        resolveSideBetOfferNotifications(supabase, closedOffers.incomingIds, auth.profile.id)
      ]);
    }
    if ((updatedCounts[sideBet.creator_id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
      const closedOffers = await closeOpenOffersForCappedPlayer(supabase, sideBet.creator_id, sideBet.week, nowIso);
      await Promise.all([
        resolveSideBetOfferNotifications(supabase, closedOffers.outgoingIds),
        resolveSideBetOfferNotifications(supabase, closedOffers.incomingIds, sideBet.creator_id)
      ]);
    }
    return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week, { sideBet: accepted }, [notificationTask]);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
