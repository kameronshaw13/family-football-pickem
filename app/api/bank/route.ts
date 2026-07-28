import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settleWeekIfReady } from "@/lib/autoSettlement";
import { getProfileFromRequest } from "@/lib/authServer";
import { normalizeEspnLogoUrl } from "@/lib/espnLogos";
import { getGameLockTime } from "@/lib/lockRules";
import { hasChargers, isEligibleSeasonGame } from "@/lib/seasonRules";
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
    const [{ data: rawGames, error: gamesError }, { data: rawPicks, error: picksError }] = await Promise.all([
      supabase.from("games").select("*").eq("week", week).order("commence_time", { ascending: true }),
      supabase.from("picks").select("*, game:games(*)").eq("week", week)
    ]);
    if (gamesError) return NextResponse.json({ ok: false, error: gamesError.message }, { status: 500 });
    if (picksError) return NextResponse.json({ ok: false, error: picksError.message }, { status: 500 });

    const requestTime = new Date();
    const uniqueGames = new Map<string, any>();
    for (const game of rawGames || []) {
      if (!isEligibleSeasonGame(game) || hasChargers(game) || game.current_spread_team == null || game.current_spread == null) continue;
      const lockTime = getGameLockTime(game.commence_time).toISOString();
      const normalized = {
        ...game,
        home_logo_url: normalizeEspnLogoUrl(game.home_logo_url),
        away_logo_url: normalizeEspnLogoUrl(game.away_logo_url),
        lock_time: lockTime,
        is_locked: requestTime >= new Date(lockTime)
      };
      const matchupKey = [game.league, game.week, game.away_team, game.home_team]
        .map((value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " "))
        .join(":");
      const existing = uniqueGames.get(matchupKey);
      if (!existing || new Date(game.updated_at || 0) > new Date(existing.updated_at || 0)) {
        uniqueGames.set(matchupKey, normalized);
      }
    }

    const games = Array.from(uniqueGames.values()).sort((a, b) =>
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );
    const gameById = new Map(games.map((game) => [game.id, game]));
    const picks = (rawPicks || []).flatMap((pick: any) => {
      const selectedGame = gameById.get(pick.game_id);
      const fallbackGame = pick.game;
      const game = selectedGame || (fallbackGame && isEligibleSeasonGame(fallbackGame) && !hasChargers(fallbackGame) ? {
        ...fallbackGame,
        home_logo_url: normalizeEspnLogoUrl(fallbackGame.home_logo_url),
        away_logo_url: normalizeEspnLogoUrl(fallbackGame.away_logo_url),
        lock_time: getGameLockTime(fallbackGame.commence_time).toISOString(),
        is_locked: requestTime >= getGameLockTime(fallbackGame.commence_time)
      } : null);
      return game ? [{ ...pick, game }] : [];
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
    if (!auth.profile.is_admin) return NextResponse.json({ ok: false, error: "Admin only." }, { status: 403 });

    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    if (body.action === "saveSettings") {
      const winnerAmount = Math.max(0, Number(body.winnerAmount));
      const loserAmount = Math.max(0, Number(body.loserAmount));
      const { error } = await supabase.from("bank_settings").upsert({ id: 1, winner_amount: winnerAmount, loser_amount: loserAmount, updated_at: new Date().toISOString() });
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, bankSettings: { id: 1, winner_amount: winnerAmount, loser_amount: loserAmount } });
    }

    const week = Number(body.week);
    const settlement = await settleWeekIfReady(supabase, week);
    if (!settlement.settled) {
      return NextResponse.json({ ok: false, error: settlement.reason || "The week is not ready to settle." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, week, perfect: settlement.perfect, entries: settlement.entries });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
