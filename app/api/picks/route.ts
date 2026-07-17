import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromToken } from "@/lib/authServer";
import { getWeekOpenTimeFromCommenceTimes } from "@/lib/lockRules";
import { isChargersTeam, isEligibleRegularSeasonGame } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam, underdogWinValue } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { getWeekRule } from "@/lib/weekRules";

const savedPickSchema = z.object({
  gameId: z.string().min(1),
  selectedTeam: z.string().min(1),
  pickType: z.enum(["regular", "underdog"])
});
const bodySchema = z.object({
  action: z.literal("saveCard"),
  week: z.number().int().nonnegative(),
  picks: z.array(savedPickSchema).max(6)
});

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
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: rawWeekGames, error: gamesError } = await supabase.from("games").select("*").eq("week", body.week);
    if (gamesError) return NextResponse.json({ ok: false, error: gamesError.message }, { status: 500 });
    const weekGames = (rawWeekGames || []).filter(isEligibleRegularSeasonGame);
    const gameMap = new Map(weekGames.map((game) => [game.id, game]));

    const weekOpen = getWeekOpenTimeFromCommenceTimes(weekGames.map((game) => game.commence_time));
    if (weekOpen && now < weekOpen) {
      return NextResponse.json({ ok: false, error: `This week opens for picks on ${weekOpen.toLocaleString("en-US", { timeZone: "America/Chicago" })} CT.` }, { status: 409 });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("picks")
      .select("*, game:games(*)")
      .eq("user_id", profile.id)
      .eq("week", body.week);
    if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });

    const existing = [...(existingRows || [])];
    for (const pick of existing) {
      if (pick.status !== "draft" || !pick.game) continue;
      if (isChargersTeam(pick.selected_team)) {
        const { error: deleteError } = await supabase.from("picks").delete().eq("id", pick.id).eq("status", "draft");
        if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
        pick.removed = true;
        continue;
      }
      if (!pick.game.is_locked && new Date(pick.game.lock_time) > now) continue;

      const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, pick.game.current_spread_team, pick.game.current_spread);
      const dogValue = pick.pick_type === "underdog" ? underdogWinValue(lockedSpread) : null;
      const { error: lockError } = await supabase.from("picks").update({
        status: "locked",
        locked_at: nowIso,
        locked_spread: lockedSpread,
        locked_spread_team: pick.selected_team,
        underdog_win_value: dogValue,
        updated_at: nowIso
      }).eq("id", pick.id).eq("status", "draft");
      if (lockError) return NextResponse.json({ ok: false, error: lockError.message }, { status: 500 });
      pick.status = "locked";
      pick.locked_at = nowIso;
      pick.locked_spread = lockedSpread;
      pick.underdog_win_value = dogValue;
    }

    const activeExisting = existing.filter((pick: any) => !pick.removed);
    const lockedPicks = activeExisting.filter((pick: any) => pick.status === "locked");
    const lockedByGame = new Map(lockedPicks.map((pick: any) => [pick.game_id, pick]));
    const submittedIds = body.picks.map((pick) => pick.gameId);
    if (new Set(submittedIds).size !== submittedIds.length) return NextResponse.json({ ok: false, error: "A game can only appear once on your card." }, { status: 400 });

    for (const locked of lockedPicks) {
      const submitted = body.picks.find((pick) => pick.gameId === locked.game_id);
      if (submitted && (submitted.selectedTeam !== locked.selected_team || submitted.pickType !== locked.pick_type)) {
        return NextResponse.json({ ok: false, error: `${locked.selected_team} is already locked and cannot be changed.` }, { status: 409 });
      }
    }

    const editablePicks = body.picks.filter((pick) => !lockedByGame.has(pick.gameId));
    for (const pick of editablePicks) {
      const game = gameMap.get(pick.gameId);
      if (!game) return NextResponse.json({ ok: false, error: "That game is outside the eligible regular season." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(pick.selectedTeam)) return NextResponse.json({ ok: false, error: "Choose a team in the selected game." }, { status: 400 });
      if (isChargersTeam(pick.selectedTeam)) return NextResponse.json({ ok: false, error: "Los Angeles Chargers picks are not allowed in this league." }, { status: 409 });
      if (game.is_locked || new Date(game.lock_time) <= now) return NextResponse.json({ ok: false, error: `${pick.selectedTeam} has reached its lock time and cannot be changed.` }, { status: 409 });

      const selectedSpread = normalizeSpreadForSelectedTeam(pick.selectedTeam, game.current_spread_team, game.current_spread);
      if (pick.pickType === "underdog" && underdogWinValue(selectedSpread) === 0) {
        return NextResponse.json({ ok: false, error: "Underdog picks must be +7 or higher." }, { status: 409 });
      }
    }

    const combined = [
      ...lockedPicks.map((pick: any) => ({ game: pick.game, pickType: pick.pick_type })),
      ...editablePicks.map((pick) => ({ game: gameMap.get(pick.gameId), pickType: pick.pickType }))
    ];
    const regular = combined.filter((pick) => pick.pickType === "regular");
    const dogs = combined.filter((pick) => pick.pickType === "underdog");
    const cfb = regular.filter((pick) => pick.game?.league === "CFB").length;
    const nfl = regular.filter((pick) => pick.game?.league === "NFL").length;
    const rule = getWeekRule(body.week);

    if (regular.length > rule.regularTotal) return NextResponse.json({ ok: false, error: `This week allows ${rule.regularTotal} regular picks.` }, { status: 409 });
    if (dogs.length > rule.underdogTotal) return NextResponse.json({ ok: false, error: "Only one underdog pick is allowed." }, { status: 409 });
    if (cfb > rule.regularTotal - rule.nflMinimum) return NextResponse.json({ ok: false, error: `This week requires ${rule.nflMinimum} NFL regular pick${rule.nflMinimum === 1 ? "" : "s"}.` }, { status: 409 });
    if (nfl > rule.regularTotal - rule.cfbMinimum) return NextResponse.json({ ok: false, error: `This week requires ${rule.cfbMinimum} CFB regular pick${rule.cfbMinimum === 1 ? "" : "s"}.` }, { status: 409 });

    const editableIds = new Set(editablePicks.map((pick) => pick.gameId));
    const draftsToDelete = activeExisting.filter((pick: any) => pick.status === "draft" && !editableIds.has(pick.game_id)).map((pick: any) => pick.id);
    if (draftsToDelete.length) {
      const { error: deleteError } = await supabase.from("picks").delete().in("id", draftsToDelete).eq("user_id", profile.id).eq("status", "draft");
      if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 });
    }

    const existingDraftByGame = new Map(activeExisting.filter((pick: any) => pick.status === "draft").map((pick: any) => [pick.game_id, pick]));
    for (const pick of editablePicks) {
      const game = gameMap.get(pick.gameId)!;
      const selectedSpread = normalizeSpreadForSelectedTeam(pick.selectedTeam, game.current_spread_team, game.current_spread);
      const dogValue = pick.pickType === "underdog" ? underdogWinValue(selectedSpread) : null;
      const saved = {
        selected_team: pick.selectedTeam,
        pick_type: pick.pickType,
        underdog_win_value: dogValue,
        status: "draft",
        result: "pending",
        updated_at: nowIso
      };
      const existingDraft: any = existingDraftByGame.get(pick.gameId);
      const query = existingDraft
        ? supabase.from("picks").update(saved).eq("id", existingDraft.id).eq("status", "draft")
        : supabase.from("picks").insert({ ...saved, user_id: profile.id, game_id: game.id, week: body.week });
      const { error: saveError } = await query;
      if (saveError) return NextResponse.json({ ok: false, error: saveError.message }, { status: 500 });
    }

    const { data: savedPicks, error: savedError } = await supabase.from("picks").select("*, game:games(*)").eq("user_id", profile.id).eq("week", body.week);
    if (savedError) return NextResponse.json({ ok: false, error: savedError.message }, { status: 500 });
    return NextResponse.json({ ok: true, picks: savedPicks || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
