import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getGroupSideBetSettings, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { createNotificationSafely, resolveSideBetOfferNotifications } from "@/lib/notifications";
import { sideBetSlotCounts } from "@/lib/sideBetLimits";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const viewWeek = z.number().int().nonnegative().optional();
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), gameId: z.string().min(1), creatorTeam: z.string().min(1), amount: z.number().positive(), recipientIds: z.array(z.string().uuid()).min(1).max(10), viewWeek }),
  z.object({ action: z.literal("accept"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("decline"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("cancel"), sideBetId: z.string().uuid(), viewWeek }),
  z.object({ action: z.literal("clear"), sideBetId: z.string().uuid(), viewWeek })
]);

function notificationSpread(value: number) {
  if (value === 0) return "Pick'em";
  return value > 0 ? `+${value}` : String(value);
}

function groupNotificationUrl(slug: string, destination: string) {
  const base = slug === "friends" ? "/friends" : slug === "other-family" ? "/other-family" : "/";
  return `${base}?notification=${encodeURIComponent(destination)}`;
}

async function allGroupBets(supabase: any, groupId: string, seasonYear: number) {
  const { data, error } = await supabase
    .from("side_bets")
    .select("*, game:games(*), creator:profiles!side_bets_creator_id_fkey(id,display_name), accepted_by_profile:profiles!side_bets_accepted_by_fkey(id,display_name), targets:side_bet_targets(*, recipient:profiles!side_bet_targets_recipient_id_fkey(id,display_name))")
    .eq("group_id", groupId)
    .eq("season_year", seasonYear)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function snapshot(supabase: any, context: any, profileId: string, week: number) {
  let rows = await allGroupBets(supabase, context.group.id, context.seasonYear);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiredIds = rows
    .filter((bet: any) => bet.status === "open" && bet.game && new Date(bet.game.commence_time) <= now)
    .map((bet: any) => bet.id);
  if (expiredIds.length) {
    await Promise.all([
      supabase.from("side_bets").update({ status: "expired", updated_at: nowIso }).eq("group_id", context.group.id).in("id", expiredIds).eq("status", "open"),
      supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).in("side_bet_id", expiredIds).eq("response", "pending")
    ]);
    await resolveSideBetOfferNotifications(supabase, expiredIds, undefined, context.group.id);
    const expired = new Set(expiredIds);
    rows = rows.map((bet: any) => expired.has(bet.id) ? { ...bet, status: "expired" } : bet);
  }
  const settings = getGroupSideBetSettings(context);
  const rawCounts = sideBetSlotCounts(rows.filter((bet: any) => Number(bet.week) === week), context.members.map((member: any) => member.id));
  return {
    sideBets: rows.filter((bet: any) => bet.creator_id === profileId || bet.accepted_by === profileId || bet.targets?.some((target: any) => target.recipient_id === profileId)),
    sideBetSlotCounts: Number.isFinite(settings.maxPerWeek)
      ? rawCounts
      : Object.fromEntries(context.members.map((member: any) => [member.id, 0]))
  };
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
      if (Number.isFinite(settings.maxAmount) && Number(body.amount) > settings.maxAmount) {
        return NextResponse.json({ ok: false, error: `Side bets are capped at $${settings.maxAmount}.` }, { status: 409 });
      }
      const memberIds = new Set(context.members.map((member) => member.id));
      const recipientIds = Array.from(new Set(body.recipientIds)).filter((id) => id !== auth.profile.id && memberIds.has(id));
      if (!recipientIds.length) return NextResponse.json({ ok: false, error: "Choose at least one other player in this group." }, { status: 400 });

      const { data: game, error: gameError } = await supabase.from("games").select("*").eq("id", body.gameId).maybeSingle();
      if (gameError || !game) return NextResponse.json({ ok: false, error: "Game not found." }, { status: 404 });
      if (!isGameAllowedForGroup(context, game)) return NextResponse.json({ ok: false, error: "That game is not available in this Pick'em group." }, { status: 409 });
      if (new Date(game.commence_time) <= now) return NextResponse.json({ ok: false, error: "Side bets must be offered before kickoff." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(body.creatorTeam)) return NextResponse.json({ ok: false, error: "Choose one of the two teams in this game." }, { status: 400 });
      const creatorSpread = normalizeSpreadForSelectedTeam(body.creatorTeam, game.current_spread_team, game.current_spread);
      if (creatorSpread == null) return NextResponse.json({ ok: false, error: "This game does not have a spread available." }, { status: 409 });

      if (Number.isFinite(settings.maxPerWeek)) {
        const rows = await allGroupBets(supabase, context.group.id, context.seasonYear);
        const counts = sideBetSlotCounts(rows.filter((bet: any) => Number(bet.week) === Number(game.week)), context.members.map((member) => member.id));
        if ((counts[auth.profile.id] || 0) >= settings.maxPerWeek) {
          return NextResponse.json({ ok: false, error: `You already have ${settings.maxPerWeek} accepted or pending side bets this week.` }, { status: 409 });
        }
        const fullRecipientId = recipientIds.find((id) => (counts[id] || 0) >= settings.maxPerWeek);
        if (fullRecipientId) {
          return NextResponse.json({ ok: false, error: `${context.members.find((member) => member.id === fullRecipientId)?.display_name || "That player"} has reached the weekly side bet limit.` }, { status: 409 });
        }
      }

      const offeredTeam = body.creatorTeam === game.home_team ? game.away_team : game.home_team;
      const amount = Math.round(Number(body.amount) * 100) / 100;
      const { data: sideBet, error: insertError } = await supabase.from("side_bets").insert({
        group_id: context.group.id,
        season_year: context.seasonYear,
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
      if (insertError) throw new Error(insertError.message);

      const targetResult = await supabase.from("side_bet_targets").insert(recipientIds.map((recipientId) => ({ side_bet_id: sideBet.id, recipient_id: recipientId })));
      if (targetResult.error) {
        await supabase.from("side_bets").delete().eq("id", sideBet.id).eq("group_id", context.group.id);
        throw new Error(targetResult.error.message);
      }

      void Promise.all(recipientIds.map((recipientId) => createNotificationSafely(supabase, {
        groupId: context.group.id,
        userId: recipientId,
        type: "side_bet_offer",
        destination: "side_bets_received",
        entityId: sideBet.id,
        dedupeKey: `side-bet-offer:${sideBet.id}`,
        title: `Side bet from ${auth.profile.display_name}`,
        body: `$${amount} · ${offeredTeam} ${notificationSpread(-creatorSpread)}`,
        url: groupNotificationUrl(context.group.slug, "side_bets_received"),
        actionRequired: true
      })));
      return NextResponse.json({ ok: true, sideBet, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? Number(game.week))) });
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
      if (sideBet.creator_id === auth.profile.id) {
        if (!["declined", "cancelled"].includes(sideBet.status)) return NextResponse.json({ ok: false, error: "Only declined or cancelled offers can be cleared." }, { status: 409 });
        const result = await supabase.from("side_bets").delete().eq("group_id", context.group.id).eq("id", sideBet.id).eq("creator_id", auth.profile.id);
        if (result.error) throw new Error(result.error.message);
      } else {
        if (!target || (target.response !== "declined" && sideBet.status !== "cancelled")) return NextResponse.json({ ok: false, error: "Only declined or cancelled offers can be cleared." }, { status: 409 });
        const result = await supabase.from("side_bet_targets").delete().eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id);
        if (result.error) throw new Error(result.error.message);
      }
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }

    if (body.action === "cancel") {
      if (sideBet.creator_id !== auth.profile.id) return NextResponse.json({ ok: false, error: "Only the sender can cancel this offer." }, { status: 403 });
      if (sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer open." }, { status: 409 });
      const result = await supabase.from("side_bets").update({ status: "cancelled", updated_at: nowIso }).eq("group_id", context.group.id).eq("id", sideBet.id).eq("status", "open");
      if (result.error) throw new Error(result.error.message);
      await supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      await resolveSideBetOfferNotifications(supabase, [sideBet.id], undefined, context.group.id);
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }

    if (!target) return NextResponse.json({ ok: false, error: "This offer was not sent to you." }, { status: 403 });
    if (target.response !== "pending" || sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer available." }, { status: 409 });
    if (!sideBet.game || new Date(sideBet.game.commence_time) <= now) return NextResponse.json({ ok: false, error: "Kickoff has passed. This offer expired." }, { status: 409 });

    if (body.action === "decline") {
      const result = await supabase.from("side_bet_targets").update({ response: "declined", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id).eq("response", "pending");
      if (result.error) throw new Error(result.error.message);
      const { count } = await supabase.from("side_bet_targets").select("recipient_id", { count: "exact", head: true }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      if (!count) await supabase.from("side_bets").update({ status: "declined", updated_at: nowIso }).eq("group_id", context.group.id).eq("id", sideBet.id).eq("status", "open");
      await resolveSideBetOfferNotifications(supabase, [sideBet.id], auth.profile.id, context.group.id);
      void createNotificationSafely(supabase, {
        groupId: context.group.id,
        userId: sideBet.creator_id,
        type: "side_bet_response",
        destination: "side_bets_sent",
        entityId: sideBet.id,
        dedupeKey: `side-bet-declined:${sideBet.id}:${auth.profile.id}`,
        title: `${auth.profile.display_name} declined your side bet`,
        body: `${sideBet.offered_team} ${notificationSpread(Number(sideBet.offered_spread))}`,
        url: groupNotificationUrl(context.group.slug, "side_bets_sent")
      });
      return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
    }

    if (Number.isFinite(settings.maxPerWeek)) {
      const rows = await allGroupBets(supabase, context.group.id, context.seasonYear);
      const counts = sideBetSlotCounts(rows.filter((bet: any) => Number(bet.week) === Number(sideBet.week)), context.members.map((member) => member.id), sideBet.id);
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
    if (!accepted) return NextResponse.json({ ok: false, error: "This offer was accepted before you could accept it." }, { status: 409 });

    await Promise.all([
      supabase.from("side_bet_targets").update({ response: "accepted", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("recipient_id", auth.profile.id),
      supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).neq("recipient_id", auth.profile.id).eq("response", "pending")
    ]);
    await resolveSideBetOfferNotifications(supabase, [sideBet.id], undefined, context.group.id);
    void createNotificationSafely(supabase, {
      groupId: context.group.id,
      userId: sideBet.creator_id,
      type: "side_bet_response",
      destination: "side_bets_sent",
      entityId: sideBet.id,
      dedupeKey: `side-bet-accepted:${sideBet.id}`,
      title: `${auth.profile.display_name} accepted your side bet`,
      body: `$${Number(sideBet.amount)} · ${sideBet.creator_team} ${notificationSpread(Number(sideBet.creator_spread))}`,
      url: groupNotificationUrl(context.group.slug, "side_bets_sent")
    });
    return NextResponse.json({ ok: true, ...(await snapshot(supabase, context, auth.profile.id, body.viewWeek ?? sideBet.week)) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
