import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProfileFromRequest } from "@/lib/authServer";
import { getGroupGameLockTime, getGroupUnderdogBonus, getGroupWeekRule, isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { getPickWeekOpenTime } from "@/lib/lockRules";
import { isEligibleSeasonGame } from "@/lib/seasonRules";
import { normalizeSpreadForSelectedTeam } from "@/lib/spreads";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

const savedPickSchema = z.object({
  gameId: z.string().min(1),
  selectedTeam: z.string().min(1),
  pickType: z.enum(["regular", "underdog"]),
  confidencePoints: z.number().int().positive().max(20).nullable().optional()
});
const bodySchema = z.object({ action: z.literal("saveCard"), week: z.number().int().nonnegative(), picks: z.array(savedPickSchema).max(12) });

function isMidweekGame(commenceTime: string, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date(commenceTime));
  return ["Tue", "Wed", "Thu", "Fri"].includes(weekday);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getProfileFromRequest(req);
    if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = bodySchema.parse(await req.json());
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const now = new Date();
    const nowIso = now.toISOString();

    const gamesResult = await supabase.from("games").select("*").eq("week", body.week);
    if (gamesResult.error) throw new Error(gamesResult.error.message);
    const weekGames = (gamesResult.data || [])
      .filter((game: any) => isEligibleSeasonGame(game) && isGameAllowedForGroup(context, game) && game.current_spread_team != null && game.current_spread != null)
      .map((game: any) => {
        const lockTime = getGroupGameLockTime(context, game.commence_time).toISOString();
        return { ...game, lock_time: lockTime, is_locked: now >= new Date(lockTime) };
      });
    const gameMap = new Map(weekGames.map((game: any) => [game.id, game]));
    const weekOpen = getPickWeekOpenTime(body.week, weekGames.map((game: any) => game.commence_time), context.group.timezone);
    if (weekOpen && now < weekOpen) {
      return NextResponse.json({ ok: false, error: `This week opens on ${weekOpen.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: context.group.timezone })}.` }, { status: 409 });
    }

    const existingResult = await supabase.from("picks").select("*, game:games(*)").eq("group_id", context.group.id).eq("season_year", context.seasonYear).eq("user_id", auth.profile.id).eq("week", body.week);
    if (existingResult.error) throw new Error(existingResult.error.message);
    const existing = (existingResult.data || []).map((pick: any) => {
      if (!pick.game) return pick;
      const lockTime = getGroupGameLockTime(context, pick.game.commence_time).toISOString();
      return { ...pick, game: { ...pick.game, lock_time: lockTime, is_locked: now >= new Date(lockTime) } };
    });

    for (const pick of existing) {
      if (pick.status !== "draft" || !pick.game || (!pick.game.is_locked && new Date(pick.game.lock_time) > now)) continue;
      const lockedSpread = normalizeSpreadForSelectedTeam(pick.selected_team, pick.game.current_spread_team, pick.game.current_spread);
      const dogValue = pick.pick_type === "underdog" ? getGroupUnderdogBonus(context, lockedSpread) : null;
      const lockResult = await supabase.from("picks").update({
        status: "locked",
        locked_at: nowIso,
        locked_spread: lockedSpread,
        locked_spread_team: pick.selected_team,
        underdog_win_value: dogValue,
        updated_at: nowIso
      }).eq("id", pick.id).eq("group_id", context.group.id).eq("status", "draft");
      if (lockResult.error) throw new Error(lockResult.error.message);
      pick.status = "locked";
      pick.locked_at = nowIso;
      pick.locked_spread = lockedSpread;
      pick.underdog_win_value = dogValue;
    }

    const lockedPicks = existing.filter((pick: any) => pick.status === "locked");
    const lockedByGame = new Map(lockedPicks.map((pick: any) => [pick.game_id, pick]));
    const submittedIds = body.picks.map((pick) => pick.gameId);
    if (new Set(submittedIds).size !== submittedIds.length) return NextResponse.json({ ok: false, error: "A game can only appear once on your card." }, { status: 400 });
    for (const locked of lockedPicks) {
      const submitted = body.picks.find((pick) => pick.gameId === locked.game_id);
      if (submitted && (submitted.selectedTeam !== locked.selected_team || submitted.pickType !== locked.pick_type)) {
        return NextResponse.json({ ok: false, error: `${locked.selected_team} is already locked and cannot be changed.` }, { status: 409 });
      }
    }

    const editable = body.picks.filter((pick) => !lockedByGame.has(pick.gameId));
    if (context.group.slug === "other-family" && auth.profile.display_name.trim().toLowerCase() === "caleb") {
      const includesMidweekPick = editable.some((pick) => {
        const game: any = gameMap.get(pick.gameId);
        return game && isMidweekGame(game.commence_time, context.group.timezone);
      });
      if (includesMidweekPick) {
        const { data: moneyRow, error: moneyError } = await supabase.from("group_week_money")
          .select("submitted_at")
          .eq("group_id", context.group.id)
          .eq("season_year", context.seasonYear)
          .eq("week", body.week)
          .maybeSingle();
        if (moneyError) throw new Error(moneyError.message);
        if (!moneyRow?.submitted_at) {
          return NextResponse.json({ ok: false, error: `Submit and lock the Week ${body.week} pot before selecting a Tuesday–Friday game.` }, { status: 409 });
        }
      }
    }
    for (const pick of editable) {
      const game: any = gameMap.get(pick.gameId);
      if (!game) return NextResponse.json({ ok: false, error: "That game is not eligible in this Pick'em group." }, { status: 409 });
      if (![game.away_team, game.home_team].includes(pick.selectedTeam)) return NextResponse.json({ ok: false, error: "Choose a team in the selected game." }, { status: 400 });
      if (game.is_locked || new Date(game.lock_time) <= now) return NextResponse.json({ ok: false, error: `${pick.selectedTeam} has reached its lock time and cannot be changed.` }, { status: 409 });
      const selectedSpread = normalizeSpreadForSelectedTeam(pick.selectedTeam, game.current_spread_team, game.current_spread);
      if (selectedSpread == null) return NextResponse.json({ ok: false, error: "This game cannot be picked until a spread is available." }, { status: 409 });
      if (pick.pickType === "underdog" && getGroupUnderdogBonus(context, selectedSpread) === 0) {
        const minimum = Number(context.rules?.underdog?.minimumSpread ?? 7);
        return NextResponse.json({ ok: false, error: `Underdog picks must be +${minimum} or higher.` }, { status: 409 });
      }
    }

    const combined = [
      ...lockedPicks.map((pick: any) => ({ game: pick.game, pickType: pick.pick_type })),
      ...editable.map((pick) => ({ game: gameMap.get(pick.gameId), pickType: pick.pickType }))
    ];
    const regular = combined.filter((pick) => pick.pickType === "regular");
    const dogs = combined.filter((pick) => pick.pickType === "underdog");
    const cfb = regular.filter((pick: any) => pick.game?.league === "CFB").length;
    const nfl = regular.filter((pick: any) => pick.game?.league === "NFL").length;
    const rule = getGroupWeekRule(context, body.week);
    if (regular.length > rule.regularTotal) return NextResponse.json({ ok: false, error: `This week allows ${rule.regularTotal} regular picks.` }, { status: 409 });
    if (dogs.length > rule.underdogTotal) return NextResponse.json({ ok: false, error: `Only ${rule.underdogTotal} underdog pick${rule.underdogTotal === 1 ? " is" : "s are"} allowed.` }, { status: 409 });
    if (cfb > rule.regularTotal - rule.nflMinimum) return NextResponse.json({ ok: false, error: `This week requires ${rule.nflMinimum} NFL regular pick${rule.nflMinimum === 1 ? "" : "s"}.` }, { status: 409 });
    if (nfl > rule.regularTotal - rule.cfbMinimum) return NextResponse.json({ ok: false, error: `This week requires ${rule.cfbMinimum} CFB regular pick${rule.cfbMinimum === 1 ? "" : "s"}.` }, { status: 409 });

    const confidenceMode = context.rules?.scoring?.mode === "confidence";
    const existingByGame = new Map(existing.map((pick: any) => [pick.game_id, pick]));
    const confidenceByGame = new Map<string, number>();
    if (confidenceMode) {
      const lockedConfidence = new Set(lockedPicks
        .filter((pick: any) => pick.pick_type === "regular")
        .map((pick: any) => Number(pick.confidence_points))
        .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= rule.regularTotal));
      const availableConfidence = Array.from({ length: rule.regularTotal }, (_, index) => rule.regularTotal - index)
        .filter((value) => !lockedConfidence.has(value));
      const editableRegular = body.picks
        .map((pick, index) => ({ pick, index }))
        .filter(({ pick }) => pick.pickType === "regular" && !lockedByGame.has(pick.gameId))
        .sort((a, b) => {
          const priorA: any = existingByGame.get(a.pick.gameId);
          const priorB: any = existingByGame.get(b.pick.gameId);
          const pointsA = Number(a.pick.confidencePoints ?? priorA?.confidence_points ?? 0);
          const pointsB = Number(b.pick.confidencePoints ?? priorB?.confidence_points ?? 0);
          return pointsB - pointsA || a.index - b.index;
        });
      editableRegular.forEach(({ pick }, index) => {
        const points = availableConfidence[index];
        if (points != null) confidenceByGame.set(pick.gameId, points);
      });
    }

    const editableIds = new Set(editable.map((pick) => pick.gameId));
    const draftsToDelete = existing.filter((pick: any) => pick.status === "draft" && !editableIds.has(pick.game_id)).map((pick: any) => pick.id);
    const existingDraftByGame = new Map(existing.filter((pick: any) => pick.status === "draft").map((pick: any) => [pick.game_id, pick]));
    const writes: Array<PromiseLike<{ error: any }>> = [];
    if (draftsToDelete.length) writes.push(supabase.from("picks").delete().eq("group_id", context.group.id).eq("user_id", auth.profile.id).eq("status", "draft").in("id", draftsToDelete));

    for (const pick of editable) {
      const game: any = gameMap.get(pick.gameId);
      const selectedSpread = normalizeSpreadForSelectedTeam(pick.selectedTeam, game.current_spread_team, game.current_spread);
      const saved = {
        selected_team: pick.selectedTeam,
        pick_type: pick.pickType,
        underdog_win_value: pick.pickType === "underdog" ? getGroupUnderdogBonus(context, selectedSpread) : null,
        confidence_points: confidenceMode && pick.pickType === "regular" ? confidenceByGame.get(pick.gameId) ?? null : null,
        status: "draft",
        result: "pending",
        updated_at: nowIso
      };
      const existingDraft: any = existingDraftByGame.get(pick.gameId);
      writes.push(existingDraft
        ? supabase.from("picks").update(saved).eq("id", existingDraft.id).eq("group_id", context.group.id).eq("status", "draft")
        : supabase.from("picks").insert({ ...saved, group_id: context.group.id, season_year: context.seasonYear, user_id: auth.profile.id, game_id: game.id, week: body.week }));
    }

    const writeResults = await Promise.all(writes);
    const failed = writeResults.find((result: any) => result.error)?.error;
    if (failed) throw new Error(failed.message);

    const savedResult = await supabase.from("picks").select("*, game:games(*)").eq("group_id", context.group.id).eq("season_year", context.seasonYear).eq("user_id", auth.profile.id).eq("week", body.week);
    if (savedResult.error) throw new Error(savedResult.error.message);
    return NextResponse.json({ ok: true, picks: savedResult.data || [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
