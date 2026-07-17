import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { hasChargers, isEligibleRegularSeasonGame } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const createSchema = z.object({
  action: z.literal("create"),
  gameId: z.string().min(1),
  creatorTeam: z.string().min(1),
  amount: z.number().positive().max(10000),
  recipientIds: z.array(z.string().uuid()).min(1).max(2)
});
const acceptSchema = z.object({ action: z.literal("accept"), sideBetId: z.string().uuid() });
const declineSchema = z.object({ action: z.literal("decline"), sideBetId: z.string().uuid() });
const cancelSchema = z.object({ action: z.literal("cancel"), sideBetId: z.string().uuid() });
const bodySchema = z.discriminatedUnion("action", [createSchema, acceptSchema, declineSchema, cancelSchema]);

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
      const { data: recipients, error: recipientError } = await supabase.from("profiles").select("id").in("id", recipientIds);
      if (recipientError) return NextResponse.json({ ok: false, error: recipientError.message }, { status: 500 });
      if (!recipientIds.length || recipients?.length !== recipientIds.length) return NextResponse.json({ ok: false, error: "Choose one or both of the other players." }, { status: 400 });

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
      return NextResponse.json({ ok: true, sideBet });
    }

    const { data: sideBet, error: sideBetError } = await supabase
      .from("side_bets")
      .select("*, game:games(*), targets:side_bet_targets(*)")
      .eq("id", body.sideBetId)
      .single();
    if (sideBetError || !sideBet) return NextResponse.json({ ok: false, error: "Side bet not found." }, { status: 404 });

    if (body.action === "cancel") {
      if (sideBet.creator_id !== auth.profile.id) return NextResponse.json({ ok: false, error: "Only the sender can cancel this offer." }, { status: 403 });
      if (sideBet.status !== "open") return NextResponse.json({ ok: false, error: "This offer is no longer open." }, { status: 409 });
      const { data: cancelled, error: cancelError } = await supabase.from("side_bets").update({ status: "cancelled", updated_at: nowIso }).eq("id", sideBet.id).eq("status", "open").select("id").maybeSingle();
      if (cancelError) return NextResponse.json({ ok: false, error: cancelError.message }, { status: 500 });
      if (!cancelled) return NextResponse.json({ ok: false, error: "This offer was accepted before it could be cancelled." }, { status: 409 });
      await supabase.from("side_bet_targets").update({ response: "closed", responded_at: nowIso }).eq("side_bet_id", sideBet.id).eq("response", "pending");
      return NextResponse.json({ ok: true });
    }

    const target = sideBet.targets?.find((row: any) => row.recipient_id === auth.profile.id);
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
      return NextResponse.json({ ok: true });
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
    return NextResponse.json({ ok: true, sideBet: accepted });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
