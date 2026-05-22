import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromToken } from "@/lib/authServer";
import { getWeekOpenTimeFromCommenceTimes } from "@/lib/lockRules";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeSpreadForSelectedTeam, underdogWinValue } from "@/lib/spreads";
import { getWeekRule } from "@/lib/weekRules";

const draftSchema = z.object({ action: z.literal("draft"), gameId: z.string(), selectedTeam: z.string(), pickType: z.enum(["regular", "underdog"]) });
const lockSchema = z.object({ action: z.literal("lock"), pickId: z.string() });
const removeSchema = z.object({ action: z.literal("remove"), pickId: z.string() });
const bodySchema = z.discriminatedUnion("action", [draftSchema, lockSchema, removeSchema]);

async function getAuthedProfile(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return { profile: null, error: "Missing auth token." };
  const profile = await getProfileFromToken(token);
  if (!profile) return { profile: null, error: "Invalid or expired session." };
  return { profile, error: null };
}

export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await getAuthedProfile(req);
    if (!profile) return NextResponse.json({ ok: false, error }, { status: 401 });

    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();

    if (body.action === "remove") {
      const { data: pick, error: pickErr } = await supabase.from("picks").select("*").eq("id", body.pickId).eq("user_id", profile.id).single();
      if (pickErr) return NextResponse.json({ ok: false, error: pickErr.message }, { status: 404 });
      if (pick.status === "locked") return NextResponse.json({ ok: false, error: "Locked picks cannot be removed." }, { status: 409 });
      const { error: deleteErr } = await supabase.from("picks").delete().eq("id", body.pickId).eq("user_id", profile.id);
      if (deleteErr) return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "draft") {
      const { data: game, error: gameErr } = await supabase.from("games").select("*").eq("id", body.gameId).single();
      if (gameErr) return NextResponse.json({ ok: false, error: gameErr.message }, { status: 404 });
      if (new Date(game.lock_time) <= new Date() || game.is_locked) {
        return NextResponse.json({ ok: false, error: "This game is closed and cannot be picked." }, { status: 409 });
      }

      const { data: weekGames, error: weekGamesErr } = await supabase.from("games").select("commence_time").eq("week", game.week);
      if (weekGamesErr) return NextResponse.json({ ok: false, error: weekGamesErr.message }, { status: 500 });
      const weekOpen = getWeekOpenTimeFromCommenceTimes((weekGames || []).map((g) => g.commence_time));
      if (weekOpen && new Date() < weekOpen) {
        return NextResponse.json({ ok: false, error: `This week opens for picks on ${weekOpen.toLocaleString("en-US", { timeZone: "America/Chicago" })} CT.` }, { status: 409 });
      }

      const selectedSpread = normalizeSpreadForSelectedTeam(body.selectedTeam, game.current_spread_team, game.current_spread);
      const dogValue = underdogWinValue(selectedSpread);
      if (body.pickType === "underdog" && dogValue === 0) {
        return NextResponse.json({ ok: false, error: "Underdog picks must be +7 or higher." }, { status: 409 });
      }

      const { data: weekPicks, error: picksErr } = await supabase
        .from("picks")
        .select("*, game:games(*)")
        .eq("user_id", profile.id)
        .eq("week", game.week);
      if (picksErr) return NextResponse.json({ ok: false, error: picksErr.message }, { status: 500 });

      const existing = weekPicks?.find((p: any) => p.game_id === body.gameId);
      if (existing?.status === "locked") return NextResponse.json({ ok: false, error: "Locked picks cannot be changed." }, { status: 409 });
      if (existing && existing.pick_type !== body.pickType) {
        return NextResponse.json({ ok: false, error: "You already have this game on your card. Remove it before switching pick type." }, { status: 409 });
      }

      const rule = getWeekRule(game.week);
      const otherPicks = (weekPicks || []).filter((p: any) => p.id !== existing?.id);
      const regularPicks = otherPicks.filter((p: any) => p.pick_type === "regular");
      const underdogPicks = otherPicks.filter((p: any) => p.pick_type === "underdog");

      if (body.pickType === "underdog" && underdogPicks.length >= rule.underdogTotal) {
        return NextResponse.json({ ok: false, error: `You can only have ${rule.underdogTotal} underdog pick per week.` }, { status: 409 });
      }

      if (body.pickType === "regular") {
        const nextRegular = [...regularPicks, { game }];
        const cfb = nextRegular.filter((p: any) => p.game?.league === "CFB").length;
        const nfl = nextRegular.filter((p: any) => p.game?.league === "NFL").length;
        if (nextRegular.length > rule.regularTotal) return NextResponse.json({ ok: false, error: `You can only have ${rule.regularTotal} regular picks this week.` }, { status: 409 });
        if (cfb > rule.cfbRequired) return NextResponse.json({ ok: false, error: `This week only allows ${rule.cfbRequired} CFB regular picks.` }, { status: 409 });
        if (nfl > rule.nflRequired) return NextResponse.json({ ok: false, error: `This week only allows ${rule.nflRequired} NFL regular picks.` }, { status: 409 });
      }

      const row = {
        user_id: profile.id,
        game_id: body.gameId,
        week: game.week,
        selected_team: body.selectedTeam,
        pick_type: body.pickType,
        status: "draft",
        underdog_win_value: body.pickType === "underdog" ? dogValue : null,
        result: "pending"
      };

      const query = existing
        ? supabase.from("picks").update({
            selected_team: body.selectedTeam,
            pick_type: body.pickType,
            underdog_win_value: body.pickType === "underdog" ? dogValue : null,
            updated_at: new Date().toISOString()
          }).eq("id", existing.id).select().single()
        : supabase.from("picks").insert(row).select().single();

      const { data, error: saveErr } = await query;
      if (saveErr) return NextResponse.json({ ok: false, error: saveErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, pick: data });
    }

    if (body.action === "lock") {
      const { data: pick, error: pickErr } = await supabase.from("picks").select("*, game:games(*)").eq("id", body.pickId).eq("user_id", profile.id).single();
      if (pickErr) return NextResponse.json({ ok: false, error: pickErr.message }, { status: 404 });
      if (pick.status === "locked") return NextResponse.json({ ok: true, pick });
      const game = pick.game;
      if (new Date(game.lock_time) <= new Date() || game.is_locked) return NextResponse.json({ ok: false, error: "This game is already closed." }, { status: 409 });

      const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread);
      const dogValue = pick.pick_type === "underdog" ? underdogWinValue(lockedSpread) : null;
      if (pick.pick_type === "underdog" && !dogValue) return NextResponse.json({ ok: false, error: "This team is no longer +7 or higher and cannot be locked as an underdog." }, { status: 409 });

      const { data, error: updateErr } = await supabase.from("picks").update({
        status: "locked",
        locked_at: new Date().toISOString(),
        locked_spread: lockedSpread,
        locked_spread_team: pick.selected_team,
        underdog_win_value: dogValue,
        updated_at: new Date().toISOString()
      }).eq("id", pick.id).select().single();
      if (updateErr) return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, pick: data });
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
