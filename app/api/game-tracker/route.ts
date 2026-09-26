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

function remainingTimeouts(situationValue: unknown, competitor: any) {
  const direct = finite(situationValue);
  if (direct != null) return direct;

  const remaining = finite(competitor?.timeoutsRemaining ?? competitor?.timeouts);
  if (remaining != null) return remaining;

  const used = finite(competitor?.timeoutsUsed);
  if (used != null) return Math.max(0, 3 - used);

  return null;
}

function scoreValue(competitor: any) {
  return finite(competitor?.score?.value ?? competitor?.score);
}

function teamIdFromPlay(play: any) {
  return String(play?.team?.id || play?.teamId || "");
}

function normalizeScoringPlay(play: any, homeId: string, awayId: string, index: number) {
  const teamId = teamIdFromPlay(play);
  return {
    id: String(play?.id || play?.sequenceNumber || `score-${index}`),
    text: String(play?.text || play?.shortText || play?.type?.text || "Scoring play"),
    period: String(play?.period?.displayValue || play?.period?.number || ""),
    clock: String(play?.clock?.displayValue || ""),
    teamSide: teamId === homeId ? "home" : teamId === awayId ? "away" : null,
    homeScore: finite(play?.homeScore),
    awayScore: finite(play?.awayScore),
    type: String(play?.type?.text || "")
  };
}

function playOutcome(play: any) {
  const type = String(play?.type?.text || "");
  const text = String(play?.text || play?.shortText || "");
  const combined = `${type} ${text}`.toLowerCase();

  if (/touchdown/.test(combined)) return "Touchdown";
  if (/field goal/.test(combined)) return "Field Goal";
  if (/extra point/.test(combined)) return "Extra Point";
  if (/two.point|2.pt|two point/.test(combined)) return "2PT";
  if (/safety/.test(combined)) return "Safety";
  if (/intercept/.test(combined)) return "Interception";
  if (/penalty/.test(combined)) return "Penalty";
  if (/fumble/.test(combined)) return "Fumble";
  if (/punt/.test(combined)) return "Punt";
  if (/no gain/.test(combined)) return "No Gain";

  const yards = finite(play?.statYardage ?? play?.yards);
  if (yards === 0) return "No Gain";
  if (yards != null) return `${yards > 0 ? "+" : ""}${yards} YD`;
  return "";
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
    situation: String(play?.start?.downDistanceText || play?.start?.shortDownDistanceText || play?.end?.downDistanceText || play?.end?.shortDownDistanceText || ""),
    outcome: playOutcome(play),
    teamSide: teamId === homeId ? "home" : teamId === awayId ? "away" : null,
    scoringPlay: Boolean(play?.scoringPlay),
    homeScore: finite(play?.homeScore),
    awayScore: finite(play?.awayScore)
  };
}

function normalizeDrive(drive: any, homeId: string, awayId: string, current: boolean, index: number, newestFirst: boolean) {
  const teamId = String(drive?.team?.id || "");
  const side = teamId === homeId ? "home" : teamId === awayId ? "away" : null;
  const rawPlays = (Array.isArray(drive?.plays) ? drive.plays : []).map((play: any, playIndex: number) =>
    normalizePlay(play, homeId, awayId, drive, playIndex)
  );
  const chronologicalPlays = rawPlays.slice().sort((a: any, b: any) => {
    if (a.sequence != null && b.sequence != null) return a.sequence - b.sequence;
    return 0;
  });
  const scorePlay = chronologicalPlays.at(-1);
  const plays = newestFirst ? chronologicalPlays.slice().reverse() : chronologicalPlays;

  return {
    id: String(drive?.id || `drive-${index}`),
    teamSide: side,
    current,
    result: String(drive?.displayResult || drive?.result || (current ? "In Progress" : "Drive")),
    description: String(drive?.description || ""),
    startText: String(drive?.start?.text || drive?.start?.yardLine || ""),
    endText: String(drive?.end?.text || drive?.end?.yardLine || ""),
    timeElapsed: String(drive?.timeElapsed?.displayValue || ""),
    yards: finite(drive?.yards),
    playsCount: chronologicalPlays.length,
    homeScore: scorePlay?.homeScore ?? null,
    awayScore: scorePlay?.awayScore ?? null,
    plays
  };
}

function periodNumber(value: string) {
  const parsed = Number(String(value || "").match(/\d+/)?.[0]);
  return Number.isFinite(parsed) ? parsed : 99;
}

function clockSeconds(value: string) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

function chronologicalDriveSort(a: any, b: any) {
  const aPlay = a.plays?.[0];
  const bPlay = b.plays?.[0];
  const periodDiff = periodNumber(aPlay?.period || "") - periodNumber(bPlay?.period || "");
  if (periodDiff !== 0) return periodDiff;
  return clockSeconds(bPlay?.clock || "") - clockSeconds(aPlay?.clock || "");
}


function fieldPositionText(situation: any) {
  const direct = String(situation?.possessionText || "").trim();
  if (direct) return direct;
  const detail = String(situation?.downDistanceText || situation?.shortDownDistanceText || "");
  return detail.match(/\bat\s+(.+)$/i)?.[1]?.trim() || "";
}

function situationYardsToGoal(situation: any, possessionSide: "home" | "away" | null, home: any, away: any) {
  const position = fieldPositionText(situation);

  if (position && possessionSide) {
    if (/^(?:50|midfield)$/i.test(position)) return 50;

    const match = position.match(/^(.+?)\s+(\d{1,2})$/);
    if (match) {
      const yard = Math.max(1, Math.min(49, Number(match[2])));
      const possession = possessionSide === "home" ? home?.team : away?.team;
      const opponent = possessionSide === "home" ? away?.team : home?.team;
      const normalize = (value: unknown) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const aliases = (team: any) => [
        team?.abbreviation,
        team?.location,
        team?.shortDisplayName,
        team?.displayName,
        team?.name
      ].map(normalize).filter(Boolean);

      const fieldSide = normalize(match[1]);
      const possessionAliases = aliases(possession);
      const opponentAliases = aliases(opponent);

      if (possessionAliases.includes(fieldSide)) return 100 - yard;
      if (opponentAliases.includes(fieldSide)) return yard;
    }
  }

  const direct = finite(situation?.yardsToEndzone ?? situation?.yardsToGoal);
  if (direct != null) return Math.max(0, Math.min(100, direct));
  return null;
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
  const out: Array<{
    side: "home" | "away";
    category: string;
    title: string;
    labels: string[];
    athletes: Array<{ name: string; values: string[] }>;
  }> = [];

  for (const team of players) {
    const id = String(team?.team?.id || "");
    const side = id === homeId ? "home" : id === awayId ? "away" : null;
    if (!side) continue;

    for (const category of team?.statistics || []) {
      const key = String(category?.name || category?.label || category?.displayName || "stats").toLowerCase();
      const title = String(category?.displayName || category?.label || category?.name || "Stats");
      const labels = Array.isArray(category?.labels) ? category.labels.map((label: any) => String(label)) : [];
      const athletes = (category?.athletes || []).map((row: any) => ({
        name: String(row?.athlete?.shortName || row?.athlete?.displayName || "Player"),
        values: Array.isArray(row?.stats) ? row.stats.map((value: any) => String(value)) : []
      }));
      if (!athletes.length) continue;
      out.push({ side, category: key, title, labels, athletes });
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

    const completed = Boolean(status?.completed);
    const priorDrives = Array.isArray(payload?.drives?.previous) ? payload.drives.previous : [];
    const currentDrive = payload?.drives?.current || null;
    const currentDriveId = currentDrive?.id ? String(currentDrive.id) : "";
    const seenDriveIds = new Set<string>();
    const uniquePreviousDrives = priorDrives.filter((drive: any, index: number) => {
      const id = String(drive?.id || `previous-${index}`);
      if ((currentDriveId && id === currentDriveId) || seenDriveIds.has(id)) return false;
      seenDriveIds.add(id);
      return true;
    });

    let drives = completed
      ? uniquePreviousDrives.map((drive: any, index: number) => normalizeDrive(drive, homeId, awayId, false, index, false)).sort(chronologicalDriveSort)
      : [
          ...(currentDrive ? [normalizeDrive(currentDrive, homeId, awayId, true, 0, true)] : []),
          ...uniquePreviousDrives.slice().reverse().map((drive: any, index: number) => normalizeDrive(drive, homeId, awayId, false, index + 1, true))
        ];

    const scoringPlays = (Array.isArray(payload?.scoringPlays) ? payload.scoringPlays : [])
      .map((play: any, index: number) => normalizeScoringPlay(play, homeId, awayId, index))
      .sort((a: any, b: any) => {
        const periodDiff = periodNumber(a.period) - periodNumber(b.period);
        if (periodDiff !== 0) return periodDiff;
        return clockSeconds(b.clock) - clockSeconds(a.clock);
      });

    const rawCurrentPlays = Array.isArray(currentDrive?.plays) ? currentDrive.plays : [];
    const latestRawPlay = rawCurrentPlays.at(-1) || null;
    const fallbackSituation = latestRawPlay?.end || latestRawPlay?.start || {};
    const payloadSituation = payload?.situation || {};
    const competitionSituation = competition?.situation || {};
    const situation = { ...fallbackSituation, ...payloadSituation, ...competitionSituation };
    const possessionId = String(competitionSituation?.possession || currentDrive?.team?.id || latestRawPlay?.team?.id || "");
    const possessionSide = possessionId === homeId ? "home" : possessionId === awayId ? "away" : null;
    const downDistanceText = String(
      competitionSituation?.shortDownDistanceText ||
      competitionSituation?.downDistanceText ||
      fallbackSituation?.shortDownDistanceText ||
      fallbackSituation?.downDistanceText ||
      ""
    );
    const down = finite(situation?.down ?? downDistanceText.match(/^(\d)/)?.[1]);
    const yardsToGoal = situationYardsToGoal(situation, possessionSide, home, away);
    const distance = finite(situation?.distance ?? downDistanceText.match(/&\s*(\d+)/)?.[1])
      ?? (/&\s*goal/i.test(downDistanceText) ? yardsToGoal : null);

    return NextResponse.json({
      ok: true,
      eventId,
      league,
      status: {
        state: String(status?.state || ""),
        detail: String(status?.shortDetail || status?.detail || ""),
        completed
      },
      teams: {
        away: {
          id: awayId,
          name: String(away?.team?.displayName || game.away_team),
          shortName: String(away?.team?.shortDisplayName || away?.team?.location || away?.team?.displayName || game.away_team),
          abbreviation: String(away?.team?.abbreviation || ""),
          logo: String(away?.team?.logo || game.away_logo_url || ""),
          color: String(away?.team?.color || "34444c"),
          alternateColor: String(away?.team?.alternateColor || "ffffff"),
          score: scoreValue(away)
        },
        home: {
          id: homeId,
          name: String(home?.team?.displayName || game.home_team),
          shortName: String(home?.team?.shortDisplayName || home?.team?.location || home?.team?.displayName || game.home_team),
          abbreviation: String(home?.team?.abbreviation || ""),
          logo: String(home?.team?.logo || game.home_logo_url || ""),
          color: String(home?.team?.color || "34444c"),
          alternateColor: String(home?.team?.alternateColor || "ffffff"),
          score: scoreValue(home)
        }
      },
      situation: {
        possessionSide,
        down,
        distance,
        yardsToGoal,
        fieldPosition: fieldPositionText(situation),
        redZone: Boolean(situation?.isRedZone),
        downDistanceText,
        homeTimeouts: remainingTimeouts(competitionSituation?.homeTimeouts ?? payloadSituation?.homeTimeouts, home),
        awayTimeouts: remainingTimeouts(competitionSituation?.awayTimeouts ?? payloadSituation?.awayTimeouts, away)
      },
      scoringPlays,
      drives,
      teamStats: normalizeTeamStats(payload?.boxscore, homeId, awayId),
      playerStats: normalizePlayerStats(payload?.boxscore, homeId, awayId)
    }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load GameTracker." }, { status: 500, headers: NO_STORE });
  }
}
