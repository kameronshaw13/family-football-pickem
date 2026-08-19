import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { getProfileFromRequest } from "@/lib/authServer";
import { normalizeEspnLogoUrl } from "@/lib/espnLogos";
import { getGroupGameLockTime, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const saveSettingsSchema = z.object({ action: z.literal("saveSettings"), winnerAmount: z.number(), loserAmount: z.number() });
const settleWeekSchema = z.object({ action: z.literal("settleWeek"), week: z.number() });
const bodySchema = z.discriminatedUnion("action", [saveSettingsSchema, settleWeekSchema]);

export async function GET(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const week = Number(req.nextUrl.searchParams.get("week"));
    if (!Number.isInteger(week) || week < 0) return NextResponse.json({ ok: false, error: "A valid week is required." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const [{ data: rawGames, error: gamesError }, { data: rawPicks, error: picksError }] = await Promise.all([
      supabase.from("games").select("*").eq("week", week).order("commence_time", { ascending: true }),
      supabase.from("picks").select("*, game:games(*)").eq("group_id", context.group.id).eq("season_year", context.seasonYear).eq("week", week)
    ]);
    if (gamesError) throw new Error(gamesError.message);
    if (picksError) throw new Error(picksError.message);
    const requestTime = new Date();
    const games = (rawGames || []).filter((game: any) => isEligibleSeasonGame(game) && isGameAllowedForGroup(context, game) && game.current_spread_team != null && game.current_spread != null).map((game: any) => {
      const lockTime = getGroupGameLockTime(context, game.commence_time).toISOString();
      return { ...game, home_logo_url: normalizeEspnLogoUrl(game.home_logo_url), away_logo_url: normalizeEspnLogoUrl(game.away_logo_url), lock_time: lockTime, is_locked: requestTime >= new Date(lockTime) };
    }).sort((a: any, b: any) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
    const gameById = new Map(games.map((game: any) => [game.id, game]));
    const picks = (rawPicks || []).flatMap((pick: any) => {
      const game = gameById.get(pick.game_id) || pick.game;
      return game && isGameAllowedForGroup(context, game) ? [{ ...pick, game }] : [];
    });
    return NextResponse.json({ ok: true, week, games, picks });
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
    if (!auth.profile.is_admin && !["owner", "admin"].includes(context.group.role)) return NextResponse.json({ ok: false, error: "Group admin only." }, { status: 403 });

    if (body.action === "saveSettings") {
      const winnerAmount = Math.max(0, Number(body.winnerAmount));
      const loserAmount = Math.max(0, Number(body.loserAmount));
      const nextRules = {
        ...context.rules,
        weeklyBank: {
          ...(context.rules?.weeklyBank || {}),
          enabled: context.rules?.weeklyBank?.enabled !== false,
          lastPaysWinner: winnerAmount,
          secondPaysWinner: loserAmount
        }
      };
      const { error } = await supabase.from("group_seasons").update({ rules: nextRules, updated_at: new Date().toISOString() }).eq("group_id", context.group.id).eq("season_year", context.seasonYear);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, bankSettings: { id: 1, winner_amount: winnerAmount, loser_amount: loserAmount } });
    }

    const settlement = await settleWeekIfReady(supabase, Number(body.week), context.group.id);
    if (!settlement.settled) return NextResponse.json({ ok: false, error: settlement.reason || "The week is not ready to settle." }, { status: 409 });
    return NextResponse.json({ ok: true, week: body.week, perfect: settlement.perfect, entries: settlement.entries });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
