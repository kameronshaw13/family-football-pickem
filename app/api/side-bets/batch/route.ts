import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getGroupSideBetSettings, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { createNotificationInBackground } from "@/lib/notifications";
import { sideBetSlotCounts } from "@/lib/sideBetLimits";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { notificationTeamName } from "@/lib/notificationTeamName";

const bodySchema = z.object({
  selections: z.array(z.object({
    gameId: z.string().min(1),
    creatorTeam: z.string().min(1)
  })).min(2).max(4),
  amount: z.number().positive(),
  recipientIds: z.array(z.string().uuid()).min(1).max(10),
  viewWeek: z.number().int().nonnegative().optional()
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

function notificationSpread(value: number) {
  if (value === 0) return "Pick'em";
  return value > 0 ? `+${value}` : String(value);
}

function groupNotificationUrl(slug: string, destination: string) {
  const base = slug === "friends" ? "/friends" : slug === "other-family" ? "/caleb-family" : "/";
  return `${base}?notification=${encodeURIComponent(destination)}`;
}

async function allGroupBets(supabase: any, groupId: string, seasonYear: number) {
  const { data, error } = await supabase
    .from("side_bets")
    .select("id,creator_id,accepted_by,status,week,targets:side_bet_targets(recipient_id,response)")
    .eq("group_id", groupId)
    .eq("season_year", seasonYear);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Choose 2 to 4 valid side bets and at least one recipient." }, { status: 400 });
    const body = parsed.data;

    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const settings = getGroupSideBetSettings(context);
    if (!settings.enabled) return NextResponse.json({ ok: false, error: "Side bets are disabled for this Pick'em group." }, { status: 409 });

    if (context.rules?.sideBets?.amountEntry === "fixed" && ![5, 10, 15, 20].includes(Number(body.amount))) {
      return NextResponse.json({ ok: false, error: "Choose a side bet amount of $20, $15, $10, or $5." }, { status: 409 });
    }
    if (Number.isFinite(settings.maxAmount) && Number(body.amount) > settings.maxAmount) {
      return NextResponse.json({ ok: false, error: `Side bets are capped at $${settings.maxAmount}.` }, { status: 409 });
    }

    const memberIds = new Set(context.members.map((member) => member.id));
    const recipientIds = Array.from(new Set(body.recipientIds)).filter((id) => id !== auth.profile.id && memberIds.has(id));
    if (!recipientIds.length) return NextResponse.json({ ok: false, error: "Choose at least one other player in this group." }, { status: 400 });

    const gameIds = body.selections.map((selection) => selection.gameId);
    if (new Set(gameIds).size !== gameIds.length) {
      return NextResponse.json({ ok: false, error: "Choose only one side from each game." }, { status: 400 });
    }

    const { data: games, error: gamesError } = await supabase.from("games").select("*").in("id", gameIds);
    if (gamesError) throw new Error(gamesError.message);
    if (!games || games.length !== gameIds.length) return NextResponse.json({ ok: false, error: "One or more selected games could not be found." }, { status: 404 });

    const gameById = new Map(games.map((game: any) => [game.id, game]));
    const now = new Date();
    const prepared = [] as Array<{ game: any; creatorTeam: string; offeredTeam: string; creatorSpread: number }>;

    for (const selection of body.selections) {
      const game = gameById.get(selection.gameId);
      if (!game) return NextResponse.json({ ok: false, error: "One or more selected games could not be found." }, { status: 404 });
      if (!isGameAllowedForGroup(context, game)) return NextResponse.json({ ok: false, error: "One of those games is not available in this Pick'em group." }, { status: 409 });
      if (new Date(game.commence_time) <= now) return NextResponse.json({ ok: false, error: "Every side bet in the batch must be sent before kickoff." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(selection.creatorTeam)) return NextResponse.json({ ok: false, error: "Choose one valid side from each game." }, { status: 400 });
      const creatorSpread = normalizeSpreadForSelectedTeam(selection.creatorTeam, game.current_spread_team, game.current_spread);
      if (creatorSpread == null) return NextResponse.json({ ok: false, error: "Every selected game must have a spread available." }, { status: 409 });
      prepared.push({
        game,
        creatorTeam: selection.creatorTeam,
        offeredTeam: selection.creatorTeam === game.home_team ? game.away_team : game.home_team,
        creatorSpread
      });
    }

    const weeks = new Set(prepared.map((selection) => Number(selection.game.week)));
    if (weeks.size !== 1) return NextResponse.json({ ok: false, error: "Batch side bets must all come from the same week." }, { status: 409 });
    const week = Number(prepared[0].game.week);

    if (Number.isFinite(settings.maxPerWeek)) {
      const rows = await allGroupBets(supabase, context.group.id, context.seasonYear);
      const counts = sideBetSlotCounts(rows.filter((bet: any) => Number(bet.week) === week), context.members.map((member) => member.id));
      const batchSize = prepared.length;
      if ((counts[auth.profile.id] || 0) + batchSize > settings.maxPerWeek) {
        const remaining = Math.max(0, settings.maxPerWeek - (counts[auth.profile.id] || 0));
        return NextResponse.json({ ok: false, error: `You only have ${remaining} side bet slot${remaining === 1 ? "" : "s"} left this week.` }, { status: 409 });
      }
      const fullRecipientId = recipientIds.find((id) => (counts[id] || 0) + batchSize > settings.maxPerWeek);
      if (fullRecipientId) {
        const member = context.members.find((candidate) => candidate.id === fullRecipientId);
        const remaining = Math.max(0, settings.maxPerWeek - (counts[fullRecipientId] || 0));
        return NextResponse.json({ ok: false, error: `${member?.display_name || "That player"} only has ${remaining} side bet slot${remaining === 1 ? "" : "s"} left this week.` }, { status: 409 });
      }
    }

    const amount = Math.round(Number(body.amount) * 100) / 100;
    const insertRows = prepared.map(({ game, creatorTeam, offeredTeam, creatorSpread }) => ({
      group_id: context.group.id,
      season_year: context.seasonYear,
      creator_id: auth.profile.id,
      game_id: game.id,
      week: game.week,
      creator_team: creatorTeam,
      offered_team: offeredTeam,
      creator_spread: creatorSpread,
      offered_spread: -creatorSpread,
      amount,
      status: "open",
      result: "pending"
    }));

    const { data: created, error: insertError } = await supabase.from("side_bets").insert(insertRows).select("*");
    if (insertError) throw new Error(insertError.message);
    if (!created || created.length !== prepared.length) throw new Error("The side bet batch could not be created completely.");

    const targetRows = created.flatMap((sideBet: any) => recipientIds.map((recipientId) => ({ side_bet_id: sideBet.id, recipient_id: recipientId })));
    const targetResult = await supabase.from("side_bet_targets").insert(targetRows);
    if (targetResult.error) {
      await supabase.from("side_bets").delete().eq("group_id", context.group.id).in("id", created.map((sideBet: any) => sideBet.id));
      throw new Error(targetResult.error.message);
    }

    const createdByGame = new Map(created.map((sideBet: any) => [sideBet.game_id, sideBet]));
    for (const selection of prepared) {
      const sideBet: any = createdByGame.get(selection.game.id);
      if (!sideBet) continue;
      for (const recipientId of recipientIds) {
        createNotificationInBackground(supabase, {
          groupId: context.group.id,
          userId: recipientId,
          type: "side_bet_offer",
          destination: "side_bets_received",
          entityId: sideBet.id,
          dedupeKey: `side-bet-offer:${sideBet.id}`,
          title: `Side bet from ${auth.profile.display_name}`,
          body: `$${amount} · ${notificationTeamName(selection.offeredTeam, selection.game.league)} ${notificationSpread(-selection.creatorSpread)}`,
          url: groupNotificationUrl(context.group.slug, "side_bets_received"),
          actionRequired: true
        });
      }
    }

    return NextResponse.json({ ok: true, createdCount: created.length, sideBetIds: created.map((sideBet: any) => sideBet.id), week: body.viewWeek ?? week }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
