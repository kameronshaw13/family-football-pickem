import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { hasChargers, isEligibleRegularSeasonGame } from "@/lib/seasonRules";
import { closeOpenOffersForCappedPlayer, getAcceptedSideBetCounts, getSideBetSlotCounts, MAX_SIDE_BETS_PER_WEEK, MAX_SIDE_BET_AMOUNT, sideBetSlotCounts } from "@/lib/sideBetLimits";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

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

async function successResponse(supabase: any, profileId: string, week: number, extra: Record<string, unknown> = {}) {
  const snapshot = await sideBetSnapshot(supabase, profileId, week);
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
      const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", body.gameId).single();
      if (gameError || !game) return NextResponse.json({ ok: false, error: "Game not found." }, { status: 404 });
      if (!isEligibleRegularSeasonGame(game)) return NextResponse.json({ ok: false, error: "Side bets are limited to eligible regular-season games." }, { status: 409 });
      if (hasChargers(game)) return NextResponse.json({ ok: false, error: "Chargers games are not available for side bets." }, { status: 409 });
      if (new Date(game.commence_time) <= now) return NextResponse.json({ ok: false, error: "Side bets must be offered before kickoff." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(body.creatorTeam)) return NextResponse.json({ ok: false, error: "Choose one of the two teams in this game." }, { status: 400 });

      const creatorSpread = normalizeSpreadForSelectedTeam(body.creatorTeam, game.current_spread_team, game.current_spread);
      if (creatorSpread == null) return NextResponse.json({ ok: false, error: "This game does not have a spread available." }, { status: 409 });

      const recipientIds = Array.from(new Set(body.recipientIds)).filter((id) => id !== auth.profile.id);
      const { data: recipients, error: recipientError } = await supabase.from("profiles").select("id,display_name").in("id", recipientIds);
      if (recipientError) return NextResponse.json({ ok: false, error: recipientError.message }, { status: 500 });
      if (!recipientIds.length || recipients?.length !== recipientIds.length) return NextResponse.json({ ok: false, error: "Choose one or both of the other players." }, { status: 400 });

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
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? game.week, { sideBet });
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
      await supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week);
    }

    if (!target) return NextResponse.json({ ok: false, error: "This offer was not sent to you." }, { status: 403 });
    if (target.response !== "pending" || sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer available." }, { status: 409 });
    if (!sideBet.game || new Date(sideBet.game.commence_time) <= now) {
      await supabase.from("side_bets").update({ status: "expired", updated_at: nowIso }).eq("id", sideBet.id).eq("status", "open");
      await supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      return NextResponse.json({ ok: false, error: "Kickoff has passed. This offer expired." }, { status: 409 });
    }

    if (body.action === "decline") {
      await supabase.from("side_bet_targets").update({ response: "declined", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id).eq("response", "pending");
      const { count } = await supabase.from("side_bet_targets").select("recipient_id", { count: "exact", head: true }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      if (!count) await supabase.from("side_bets").update({ status: "declined", updated_at: nowIso }).eq("id", sideBet.id).eq("status", "open");
      return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week);
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

    await supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending");
    await supabase.from("side_bet_targets").update({ response: "accepted", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id);
    const updatedCounts = await getAcceptedSideBetCounts(supabase, sideBet.week, [auth.profile.id, sideBet.creator_id]);
    if ((updatedCounts[auth.profile.id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
      await closeOpenOffersForCappedPlayer(supabase, auth.profile.id, sideBet.week, nowIso);
    }
    if ((updatedCounts[sideBet.creator_id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {
      await closeOpenOffersForCappedPlayer(supabase, sideBet.creator_id, sideBet.week, nowIso);
    }
    return successResponse(supabase, auth.profile.id, body.viewWeek ?? sideBet.week, { sideBet: accepted });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
