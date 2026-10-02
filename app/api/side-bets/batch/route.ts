import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getGroupSideBetSettings, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { createNotificationInBackground } from "@/lib/notifications";
import { MAX_CUSTOM_SIDE_BET_AMOUNT, sideBetSlotCounts } from "@/lib/sideBetLimits";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { americanOddsText, oppositeAmericanOdds, profitForRisk, validAmericanOdds } from "@/lib/sideBetMarkets";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { notificationTeamName } from "@/lib/notificationTeamName";

const bodySchema = z.object({
  selections: z.array(z.object({
    gameId: z.string().min(1),
    creatorTeam: z.string().min(1),
    creatorSpread: z.number().finite().min(-100).max(100).optional(),
    amount: z.number().positive(),
    marketType: z.enum(["spread", "moneyline"]),
    creatorOdds: z.number().int(),
    recipientIds: z.array(z.string().uuid()).min(1).max(10)
  })).min(1).max(8),
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
    if (!parsed.success) return NextResponse.json({ ok: false, error: "Choose 1 to 8 valid side bets and at least one recipient." }, { status: 400 });
    const body = parsed.data;

    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const settings = getGroupSideBetSettings(context);
    if (!settings.enabled) return NextResponse.json({ ok: false, error: "Side bets are disabled for this Pick'em group." }, { status: 409 });

    const memberIds = new Set(context.members.map((member) => member.id));
    const gameIds = body.selections.map((selection) => selection.gameId);
    if (new Set(gameIds).size !== gameIds.length) {
      return NextResponse.json({ ok: false, error: "Choose only one side from each game." }, { status: 400 });
    }

    const { data: games, error: gamesError } = await supabase.from("games").select("*").in("id", gameIds);
    if (gamesError) throw new Error(gamesError.message);
    if (!games || games.length !== gameIds.length) return NextResponse.json({ ok: false, error: "One or more selected games could not be found." }, { status: 404 });

    const gameById = new Map(games.map((game: any) => [game.id, game]));
    const now = new Date();
    const amountCap = context.rules?.sideBets?.amountEntry === "free" ? MAX_CUSTOM_SIDE_BET_AMOUNT : settings.maxAmount;
    const prepared = [] as Array<{
      game: any;
      creatorTeam: string;
      offeredTeam: string;
      creatorSpread: number;
      amount: number;
      marketType: "spread" | "moneyline";
      creatorOdds: number;
      recipientIds: string[];
    }>;

    for (const selection of body.selections) {
      const game = gameById.get(selection.gameId);
      if (!game) return NextResponse.json({ ok: false, error: "One or more selected games could not be found." }, { status: 404 });
      if (!isGameAllowedForGroup(context, game)) return NextResponse.json({ ok: false, error: "One of those games is not available in this Pick'em group." }, { status: 409 });
      if (new Date(game.commence_time) <= now) return NextResponse.json({ ok: false, error: "Every side bet in the batch must be sent before kickoff." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(selection.creatorTeam)) return NextResponse.json({ ok: false, error: "Choose one valid side from each game." }, { status: 400 });

      const amount = Math.round(Number(selection.amount) * 100) / 100;
      if (context.rules?.sideBets?.amountEntry === "fixed" && ![5, 10, 15, 20].includes(amount)) {
        return NextResponse.json({ ok: false, error: "Each side bet must use an allowed amount." }, { status: 409 });
      }
      if (Number.isFinite(amountCap) && amount > amountCap) {
        return NextResponse.json({ ok: false, error: `Side bets are capped at $${amountCap}.` }, { status: 409 });
      }
      if (!validAmericanOdds(selection.creatorOdds)) {
        return NextResponse.json({ ok: false, error: "Every side bet must have valid American odds." }, { status: 400 });
      }

      const recipientIds = Array.from(new Set(selection.recipientIds))
        .filter((id) => id !== auth.profile.id && memberIds.has(id));
      if (!recipientIds.length) {
        return NextResponse.json({ ok: false, error: "Every selected side bet needs at least one recipient." }, { status: 400 });
      }

      const currentCreatorSpread = normalizeSpreadForSelectedTeam(selection.creatorTeam, game.current_spread_team, game.current_spread);
      const creatorSpread = selection.marketType === "moneyline" ? 0 : (selection.creatorSpread ?? currentCreatorSpread);
      if (selection.marketType === "spread" && creatorSpread == null) {
        return NextResponse.json({ ok: false, error: "Every selected spread bet must have a line." }, { status: 409 });
      }

      prepared.push({
        game,
        creatorTeam: selection.creatorTeam,
        offeredTeam: selection.creatorTeam === game.home_team ? game.away_team : game.home_team,
        creatorSpread: Number(creatorSpread ?? 0),
        amount,
        marketType: selection.marketType,
        creatorOdds: selection.creatorOdds,
        recipientIds
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
      const recipientUsage = new Map<string, number>();
      for (const selection of prepared) {
        for (const recipientId of selection.recipientIds) {
          recipientUsage.set(recipientId, (recipientUsage.get(recipientId) || 0) + 1);
        }
      }
      const fullRecipientId = Array.from(recipientUsage.entries())
        .find(([id, added]) => (counts[id] || 0) + added > settings.maxPerWeek)?.[0];
      if (fullRecipientId) {
        const member = context.members.find((candidate) => candidate.id === fullRecipientId);
        const remaining = Math.max(0, settings.maxPerWeek - (counts[fullRecipientId] || 0));
        return NextResponse.json({ ok: false, error: `${member?.display_name || "That player"} only has ${remaining} side bet slot${remaining === 1 ? "" : "s"} left this week.` }, { status: 409 });
      }
    }

    const insertRows = prepared.map(({ game, creatorTeam, offeredTeam, creatorSpread, amount, marketType, creatorOdds }) => ({
      group_id: context.group.id,
      season_year: context.seasonYear,
      creator_id: auth.profile.id,
      game_id: game.id,
      week: game.week,
      creator_team: creatorTeam,
      offered_team: offeredTeam,
      creator_spread: creatorSpread,
      offered_spread: -creatorSpread,
      market_type: marketType,
      offer_phase: "pregame",
      creator_odds: creatorOdds,
      amount,
      status: "open",
      result: "pending"
    }));

    const { data: created, error: insertError } = await supabase.from("side_bets").insert(insertRows).select("*");
    if (insertError) throw new Error(insertError.message);
    if (!created || created.length !== prepared.length) throw new Error("The side bet batch could not be created completely.");

    const createdByGame = new Map(created.map((sideBet: any) => [sideBet.game_id, sideBet]));
    const targetRows = prepared.flatMap((selection) => {
      const sideBet: any = createdByGame.get(selection.game.id);
      if (!sideBet) return [];
      return selection.recipientIds.map((recipientId) => ({ side_bet_id: sideBet.id, recipient_id: recipientId }));
    });
    const targetResult = await supabase.from("side_bet_targets").insert(targetRows);
    if (targetResult.error) {
      await supabase.from("side_bets").delete().eq("group_id", context.group.id).in("id", created.map((sideBet: any) => sideBet.id));
      throw new Error(targetResult.error.message);
    }

    for (const selection of prepared) {
      const sideBet: any = createdByGame.get(selection.game.id);
      if (!sideBet) continue;
      for (const recipientId of selection.recipientIds) {
        createNotificationInBackground(supabase, {
          groupId: context.group.id,
          userId: recipientId,
          type: "side_bet_offer",
          destination: "side_bets_received",
          entityId: sideBet.id,
          dedupeKey: `side-bet-offer:${sideBet.id}`,
          title: `Side bet from ${auth.profile.display_name}`,
          body: `Risk ${profitForRisk(selection.amount, selection.creatorOdds)} · ${notificationTeamName(selection.offeredTeam, selection.game.league)} ${selection.marketType === "moneyline" ? "ML" : notificationSpread(-selection.creatorSpread)} ${americanOddsText(oppositeAmericanOdds(selection.creatorOdds))}`,
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
