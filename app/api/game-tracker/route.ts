import { NextRequest, NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/authServer";
import { isGameAllowedForGroup, requestedGroupFromRequest, resolveGroupContext } from "@/lib/groupContext";
import { fetchEspnSchedule, resolveEspnScheduleMatch } from "@/lib/espnSchedule";
import { getSupabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function finite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreValue(competitor: any) {
  return finite(competitor?.score?.value ?? competitor?.score);
}

function teamIdFromPlay(play: any) {
  return String(play?.team?.id || play?.teamId || "");
}

function normalizeScoringPlay(play: any, homeId: string, awayId: string) {
  const teamId = teamIdFromPlay(play);
  return {
    id: String(play?.id || play?.sequenceNumber || Math.random()),
    text: String(play?.text || play?.shortText || play?.type?.text || "Scoring play"),
    period: String(play?.period?.displayValue || play?.period?.number || ""),
    clock: String(play?.clock?.displayValue || ""),
    teamSide: teamId === homeId ? "home" : teamId === awayId ? "away" : null,
    homeScore: finite(play?.homeScore),
    awayScore: finite(play?.awayScore),
    type: String(play?.type?.text || "")
  };
}

function normalizePlay(play: any, homeId: string, awayId: string, drive: any, index: number) {
  const teamId = teamIdFromPlay(play) || String(drive?.team?.id || "");
  const sequence = finite(play?.sequenceNumber ?? play?.id);
  return {
    id: String(play?.id || `${drive?.id || "drive"}-${index}`),
    sequence,
    text: String(play?.text || play?.shortText || play?.type?.text || "Play"),
    period: String(play?.period?.displayValue || play?.period?.number || ""),
    clock: String(play?.clock?.displayValue || ""),
    situation: String(play?.start?.downDistanceText || play?.start?.shortDownDistanceText || play?.end?.downDistanceText || ""),
    teamSide: teamId === homeId ? "home" : teamId === awayId ? "away" : null,
    scoringPlay: Boolean(play?.scoringPlay),
    homeScore: finite(play?.homeScore),
    awayScore: finite(play?.awayScore),
    driveResult: String(drive?.displayResult || drive?.result || "")
  };
}

function normalizeTeamStats(boxscore: any, homeId: string, awayId: string) {
  const teams = Array.isArray(boxscore?.teams) ? boxscore.teams : [];
  const bySide: Record<"home" | "away", Record<string, string>> = { home: {}, away: {} };
  for (const row of teams) {
    const id = String(row?.team?.id || "");
    const side = id === homeId ? "home" : id === awayId ? "away" : null;
    if (!side) continue;
    for (const stat of row?.statistics || []) {
      const key = String(stat?.name || stat?.label || "");
      if (!key) continue;
      bySide[side][key] = String(stat?.displayValue ?? stat?.value ?? "—");
    }
  }
  const aliases: Array<[string, string[]]> = [
    ["First Downs", ["firstDowns"]],
    ["Total Yards", ["totalYards"]],
    ["Passing", ["netPassingYards", "passingYards"]],
    ["Rushing", ["rushingYards"]],
    ["3rd Down", ["thirdDownEff"]],
    ["Turnovers", ["turnovers"]],
    ["Possession", ["possessionTime"]]
  ];
  return aliases.map(([label, keys]) => {
    const get = (side: "home" | "away") => keys.map(key => bySide[side][key]).find(Boolean) || "—";
    return { label, away: get("away"), home: get("home") };
  });
}

function normalizePlayerStats(boxscore: any, homeId: string, awayId: string) {
  const players = Array.isArray(boxscore?.players) ? boxscore.players : [];
  const out: Array<{ side: "home" | "away"; category: string; labels: string[]; athletes: Array<{ name: string; values: string[] }> }> = [];
  for (const team of players) {
    const id = String(team?.team?.id || "");
    const side = id === homeId ? "home" : id === awayId ? "away" : null;
    if (!side) continue;
    for (const category of team?.statistics || []) {
      const name = String(category?.name || category?.label || "").toLowerCase();
      if (!["passing", "rushing", "receiving"].includes(name)) continue;
      const labels = Array.isArray(category?.labels) ? category.labels.map((label: any) => String(label)) : [];
      const athletes = (category?.athletes || []).slice(0, 4).map((row: any) => ({
        name: String(row?.athlete?.shortName || row?.athlete?.displayName || "Player"),
        values: Array.isArray(row?.stats) ? row.stats.map((value: any) => String(value)) : []
      }));
      out.push({ side, category: name, labels, athletes });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await getProfileFromRequest(req);
  if (!auth.profile) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE });
  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!gameId || gameId.length > 120) return NextResponse.json({ ok: false, error: "A valid game is required." }, { status: 400, headers: NO_STORE });

  try {
    const supabase = getSupabaseAdmin();
    const context = await resolveGroupContext(supabase, auth.profile.id, requestedGroupFromRequest(req));
    const { data: game, error } = await supabase.from("games")
      .select("id,espn_event_id,league,week,commence_time,home_team,away_team,home_logo_url,away_logo_url,final_home_score,final_away_score")
      .eq("id", gameId).maybeSingle();
    if (error) throw error;
    if (!game || !isGameAllowedForGroup(context, game)) return NextResponse.json({ ok: false, error: "Game not found." }, { status: 404, headers: NO_STORE });

    const league = game.league === "NFL" ? "NFL" : "CFB";
    let eventId = String(game.espn_event_id || "");
    if (!eventId) {
      const schedule = await fetchEspnSchedule(league, [game.commence_time], true, 1);
      const match = await resolveEspnScheduleMatch(game, schedule, league, { freshness: true });
      eventId = match?.game?.id || "";
    }
    if (!eventId) return NextResponse.json({ ok: false, error: "Live game data is not available yet." }, { status: 404, headers: NO_STORE });

    const sportPath = league === "NFL" ? "nfl" : "college-football";
    const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/summary`);
    url.searchParams.set("event", eventId);
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`ESPN summary failed (${response.status})`);
    const payload = await response.json();

    const competition = payload?.header?.competitions?.[0];
    const home = competition?.competitors?.find((row: any) => row.homeAway === "home");
    const away = competition?.competitors?.find((row: any) => row.homeAway === "away");
    const homeId = String(home?.team?.id || "");
    const awayId = String(away?.team?.id || "");
    const status = competition?.status?.type || {};

    const drives = [
      ...(Array.isArray(payload?.drives?.previous) ? payload.drives.previous : []),
      ...(payload?.drives?.current ? [payload.drives.current] : [])
    ];
    const plays = drives.flatMap((drive: any) =>
      (Array.isArray(drive?.plays) ? drive.plays : []).map((play: any, index: number) => normalizePlay(play, homeId, awayId, drive, index))
    ).sort((a: any, b: any) => {
      if (a.sequence != null && b.sequence != null) return b.sequence - a.sequence;
      return 0;
    });

    const scoringPlays = (Array.isArray(payload?.scoringPlays) ? payload.scoringPlays : [])
      .map((play: any) => normalizeScoringPlay(play, homeId, awayId))
      .reverse();

    return NextResponse.json({
      ok: true,
      eventId,
      league,
      status: {
        state: String(status?.state || ""),
        detail: String(status?.shortDetail || status?.detail || ""),
        completed: Boolean(status?.completed)
      },
      teams: {
        away: {
          id: awayId,
          name: String(away?.team?.displayName || game.away_team),
          abbreviation: String(away?.team?.abbreviation || ""),
          logo: String(away?.team?.logo || game.away_logo_url || ""),
          score: scoreValue(away)
        },
        home: {
          id: homeId,
          name: String(home?.team?.displayName || game.home_team),
          abbreviation: String(home?.team?.abbreviation || ""),
          logo: String(home?.team?.logo || game.home_logo_url || ""),
          score: scoreValue(home)
        }
      },
      scoringPlays,
      plays,
      teamStats: normalizeTeamStats(payload?.boxscore, homeId, awayId),
      playerStats: normalizePlayerStats(payload?.boxscore, homeId, awayId)
    }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load GameTracker." }, { status: 500, headers: NO_STORE });
  }
}
