import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { normalizeEspnLogoUrl } from "@/lib/espnLogos";

type EspnTeam = {
  displayName: string;
  location: string;
  nickname: string;
  abbreviation: string;
  logoUrl: string | null;
};

export type EspnScheduleGame = {
  id: string;
  commenceTime: string;
  timeValid: boolean;
  completed: boolean;
  homeScore: number | null;
  awayScore: number | null;
  statusDetail: string | null;
  statusState: string | null;
  possessionSide: "home" | "away" | null;
  situationText: string | null;
  redZone: boolean;
  down: number | null;
  distance: number | null;
  yardsToGoal: number | null;
  homeTimeouts: number | null;
  awayTimeouts: number | null;
  homeTeam: EspnTeam;
  awayTeam: EspnTeam;
};

export type EspnScheduleMatch = {
  game: EspnScheduleGame;
  swapped: boolean;
};

export type EspnWinProbability = {
  home: number;
  away: number;
  tie: number;
};

type Matchup = {
  espn_event_id?: string | null;
  commence_time: string;
  home_team: string;
  away_team: string;
};

const MIN_TWO_SIDED_IDENTITY_SCORE = 80;
const STRONG_ONE_SIDED_IDENTITY_SCORE = 110;
const ONE_SIDED_MATCH_MAX_DISTANCE_MS = 36 * 60 * 60 * 1000;

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/hawai[\s'’`-]*i/g, "hawaii")
    .replace(/\bst\.?\b/g, "state")
    .replace(/\bmiss(?:issippi)?\s+state\b/g, "mississippi state")
    .replace(/\bmiss\s+valley\s+state\b/g, "mississippi valley state")
    .replace(/\bsouthern mississippi\b/g, "southern miss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function includesAll(haystack: Set<string>, needles: Set<string>) {
  return needles.size > 0 && Array.from(needles).every((token) => haystack.has(token));
}

function hasEmbeddedAbbreviation(sourceName: string, abbreviation: string) {
  const normalizedAbbreviation = normalize(abbreviation);
  const sourceTokens = normalize(sourceName).split(" ").filter(Boolean);
  // Two-letter abbreviations are too collision-prone. Longer ESPN abbreviations
  // are accepted only as the provider name's leading school token. This keeps
  // aliases such as LIU Post / BYU / UCF while preventing Northern Iowa -> Iowa.
  return normalizedAbbreviation.length >= 3 &&
    !normalizedAbbreviation.includes(" ") &&
    sourceTokens[0] === normalizedAbbreviation;
}

function identityScore(sourceName: string, team: EspnTeam) {
  const source = normalize(sourceName);
  const aliases = [team.displayName, `${team.location} ${team.nickname}`, team.location, team.abbreviation]
    .map(normalize)
    .filter(Boolean);
  if (aliases.includes(source)) return 120;

  const sourceTokens = tokenSet(source);
  if (hasEmbeddedAbbreviation(source, team.abbreviation)) return 110;

  const locationTokens = tokenSet(team.location);
  const nicknameTokens = tokenSet(team.nickname);
  if (includesAll(sourceTokens, locationTokens) && includesAll(sourceTokens, nicknameTokens)) return 110;
  if (locationTokens.size >= 2 && includesAll(sourceTokens, locationTokens)) return 95;

  const displayTokens = tokenSet(team.displayName);
  const overlap = Array.from(displayTokens).filter((token) => sourceTokens.has(token)).length;
  return overlap >= 2 ? Math.round((overlap / Math.max(displayTokens.size, sourceTokens.size)) * 80) : 0;
}

function alignmentScore(firstTeamScore: number, secondTeamScore: number, kickoffDistance: number, allowOneSided: boolean) {
  if (Math.min(firstTeamScore, secondTeamScore) >= MIN_TWO_SIDED_IDENTITY_SCORE) {
    return firstTeamScore + secondTeamScore;
  }

  // Some odds providers retain legacy or alternate names for smaller schools.
  // When one side is an exact/very strong identity, the kickoff window safely
  // disambiguates the opponent without making ordinary team-name matching fuzzy.
  if (allowOneSided &&
      Number.isFinite(kickoffDistance) &&
      kickoffDistance <= ONE_SIDED_MATCH_MAX_DISTANCE_MS &&
      Math.max(firstTeamScore, secondTeamScore) >= STRONG_ONE_SIDED_IDENTITY_SCORE) {
    return Math.max(firstTeamScore, secondTeamScore);
  }

  return 0;
}

function teamFromCompetitor(competitor: any): EspnTeam {
  const team = competitor?.team || {};
  return {
    displayName: team.displayName || "",
    location: team.location || team.shortDisplayName || "",
    nickname: team.name || "",
    abbreviation: team.abbreviation || "",
    logoUrl: normalizeEspnLogoUrl(team.logo || team.logos?.[0]?.href)
  };
}

function scoreFromCompetitor(competitor: any) {
  const rawScore = competitor?.score?.value ?? competitor?.score;
  const score = Number(rawScore);
  return Number.isFinite(score) ? score : null;
}

function finiteSituationNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fieldPositionText(situation: any) {
  const direct = String(situation?.possessionText || "").trim();
  if (direct) return direct;
  const detail = String(situation?.downDistanceText || situation?.shortDownDistanceText || "");
  return detail.match(/\bat\s+(.+)$/i)?.[1]?.trim() || "";
}

function situationYardsToGoal(situation: any, possessionSide: "home" | "away" | null, home: any, away: any) {
  const fieldPosition = fieldPositionText(situation);
  if (!fieldPosition || !possessionSide) return null;
  if (/^(?:50|midfield)$/i.test(fieldPosition)) return 50;

  const match = fieldPosition.match(/^(.+?)\s+(\d{1,2})$/);
  if (!match) return null;
  const yardLine = Math.max(1, Math.min(49, Number(match[2])));
  const possessionTeam = possessionSide === "home" ? home?.team : away?.team;
  const opponentTeam = possessionSide === "home" ? away?.team : home?.team;
  const fieldSide = normalize(match[1]);
  const possessionAliases = [possessionTeam?.abbreviation, possessionTeam?.location, possessionTeam?.shortDisplayName].map(normalize);
  const opponentAliases = [opponentTeam?.abbreviation, opponentTeam?.location, opponentTeam?.shortDisplayName].map(normalize);

  if (possessionAliases.includes(fieldSide)) return 100 - yardLine;
  if (opponentAliases.includes(fieldSide)) return yardLine;
  return null;
}

function compactDate(date: Date) {
  // ESPN football scoreboards group games by the U.S. football calendar date,
  // not the UTC date. A Thursday 8:15 PM ET NFL kickoff is already Friday in
  // UTC, so using UTC here can make the entire event disappear from the feed.
  const eastern = toZonedTime(date, "America/New_York");
  const year = eastern.getFullYear();
  const month = String(eastern.getMonth() + 1).padStart(2, "0");
  const day = String(eastern.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function fetchEspnWinProbability(league: "NFL" | "CFB", eventId: string, freshness: boolean | number = 10): Promise<EspnWinProbability | null> {
  const sportPath = league === "NFL" ? "nfl" : "college-football";
  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/summary`);
  url.searchParams.set("event", eventId);
  const response = await fetch(url.toString(), freshness === true
    ? { cache: "no-store" }
    : { next: { revalidate: typeof freshness === "number" ? freshness : 10 } });
  if (!response.ok) return null;
  const payload = await response.json();
  const probabilities = Array.isArray(payload?.winprobability) ? payload.winprobability : [];
  for (let index = probabilities.length - 1; index >= 0; index -= 1) {
    const home = Number(probabilities[index]?.homeWinPercentage);
    const tie = Number(probabilities[index]?.tiePercentage || 0);
    if (!Number.isFinite(home) || !Number.isFinite(tie)) continue;
    const clampedHome = Math.max(0, Math.min(1, home));
    const clampedTie = Math.max(0, Math.min(1 - clampedHome, tie));
    return {
      home: clampedHome,
      away: Math.max(0, 1 - clampedHome - clampedTie),
      tie: clampedTie
    };
  }
  return null;
}

export async function fetchEspnEvent(
  league: "NFL" | "CFB",
  eventId: string,
  freshness: boolean | number = true
): Promise<EspnScheduleGame | null> {
  const sportPath = league === "NFL" ? "nfl" : "college-football";
  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/summary`);
  url.searchParams.set("event", eventId);
  const response = await fetch(url.toString(), freshness === true
    ? { cache: "no-store" }
    : { next: { revalidate: typeof freshness === "number" ? freshness : 10 } });
  if (!response.ok) return null;

  const payload = await response.json();
  const competition = payload?.header?.competitions?.[0];
  const home = competition?.competitors?.find((competitor: any) => competitor.homeAway === "home");
  const away = competition?.competitors?.find((competitor: any) => competitor.homeAway === "away");
  const commenceTime = competition?.date || payload?.header?.date;
  if (!competition || !home || !away || !commenceTime) return null;

  const possessionId = String(competition?.situation?.possession || "");
  const possessionSide = possessionId && possessionId === String(home?.team?.id)
    ? "home"
    : possessionId && possessionId === String(away?.team?.id)
      ? "away"
      : null;
  const situation = competition?.situation;
  const situationText = situation?.downDistanceText || situation?.shortDownDistanceText || null;
  const yardsToGoal = situationYardsToGoal(situation, possessionSide, home, away);
  const parsedDown = situationText?.match(/^(\d)(?:st|nd|rd|th)\b/i)?.[1];
  const parsedDistance = situationText?.match(/&\s*(\d+)\b/i)?.[1];
  const down = finiteSituationNumber(situation?.down ?? parsedDown);
  const distance = finiteSituationNumber(situation?.distance ?? parsedDistance) ?? (/&\s*goal\b/i.test(situationText || "") ? yardsToGoal : null);

  return {
    id: String(payload?.header?.id || eventId),
    commenceTime,
    timeValid: competition?.timeValid !== false,
    completed: Boolean(competition?.status?.type?.completed),
    homeScore: scoreFromCompetitor(home),
    awayScore: scoreFromCompetitor(away),
    statusDetail: competition?.status?.type?.shortDetail || competition?.status?.type?.detail || null,
    statusState: competition?.status?.type?.state || null,
    possessionSide,
    situationText,
    redZone: Boolean(situation?.isRedZone),
    down,
    distance,
    yardsToGoal,
    homeTimeouts: finiteSituationNumber(situation?.homeTimeouts),
    awayTimeouts: finiteSituationNumber(situation?.awayTimeouts),
    homeTeam: teamFromCompetitor(home),
    awayTeam: teamFromCompetitor(away)
  };
}

export async function fetchEspnSchedule(league: "NFL" | "CFB", dateHints: string[], freshness: boolean | number = false, paddingDays = 3) {
  const parsedDates = dateHints.map((date) => new Date(date)).filter((date) => !Number.isNaN(date.getTime()));
  if (!parsedDates.length) return [];

  const sportPath = league === "NFL" ? "nfl" : "college-football";
  const fetchScoreboardEvents = async (datesParam: string) => {
    const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/scoreboard`);
    url.searchParams.set("limit", "1000");
    if (league === "CFB") url.searchParams.set("groups", "80");
    url.searchParams.set("dates", datesParam);

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url.toString(), freshness === true
          ? { cache: "no-store" }
          : { next: { revalidate: typeof freshness === "number" ? freshness : 60 * 60 } });
        if (!response.ok) {
          const details = (await response.text().catch(() => "")).slice(0, 240);
          throw new Error(`ESPN schedule failed for ${league} (${response.status}) dates=${datesParam}${details ? `: ${details}` : ""}`);
        }
        const payload = await response.json();
        return Array.isArray(payload?.events) ? payload.events : [];
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250));
      }
    }
    throw lastError || new Error(`ESPN schedule failed for ${league} dates=${datesParam}`);
  };

  // ESPN's scoreboard no longer reliably accepts date ranges, and season-wide
  // queries can return an incomplete current slate. Query exact calendar dates
  // derived from the provider events instead. A one-day cushion handles rare
  // provider timezone/date disagreements without reintroducing range syntax.
  const exactDates = new Set<string>();
  const exactPaddingDays = Math.min(1, Math.max(0, paddingDays));
  for (const date of parsedDates) {
    for (let offset = -exactPaddingDays; offset <= exactPaddingDays; offset += 1) {
      const adjusted = new Date(date);
      adjusted.setUTCDate(adjusted.getUTCDate() + offset);
      exactDates.add(compactDate(adjusted));
    }
  }

  const dateResults = await Promise.allSettled(Array.from(exactDates).map(fetchScoreboardEvents));
  const successfulDateResults = dateResults.filter((result): result is PromiseFulfilledResult<any[]> => result.status === "fulfilled");
  if (!successfulDateResults.length) {
    const firstFailure = dateResults.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw firstFailure?.reason instanceof Error
      ? firstFailure.reason
      : new Error(`ESPN schedule failed for ${league}`);
  }
  const failedDates = dateResults.filter((result) => result.status === "rejected").length;
  if (failedDates) {
    console.warn(`[espnSchedule] ${league} loaded with ${failedDates} failed date request(s); using successful dates.`);
  }
  const events = successfulDateResults.flatMap((result) => result.value);

  const uniqueEvents = Array.from(new Map(events.map((event: any) => [
    String(event?.id || `${event?.date || ""}:${event?.name || ""}`),
    event
  ])).values());

  return uniqueEvents.flatMap((event: any): EspnScheduleGame[] => {
    const competition = event?.competitions?.[0];
    const home = competition?.competitors?.find((competitor: any) => competitor.homeAway === "home");
    const away = competition?.competitors?.find((competitor: any) => competitor.homeAway === "away");
    const commenceTime = competition?.date || event?.date;
    if (!home || !away || !commenceTime) return [];
    const possessionId = String(competition?.situation?.possession || "");
    const possessionSide = possessionId && possessionId === String(home?.team?.id)
      ? "home"
      : possessionId && possessionId === String(away?.team?.id)
        ? "away"
        : null;
    const situation = competition?.situation;
    const situationText = situation?.downDistanceText || situation?.shortDownDistanceText || null;
    const yardsToGoal = situationYardsToGoal(situation, possessionSide, home, away);
    const parsedDown = situationText?.match(/^(\d)(?:st|nd|rd|th)\b/i)?.[1];
    const parsedDistance = situationText?.match(/&\s*(\d+)\b/i)?.[1];
    const down = finiteSituationNumber(situation?.down ?? parsedDown);
    const distance = finiteSituationNumber(situation?.distance ?? parsedDistance) ?? (/&\s*goal\b/i.test(situationText || "") ? yardsToGoal : null);
    return [{
      id: String(event.id),
      commenceTime,
      timeValid: competition?.timeValid !== false,
      completed: Boolean(competition?.status?.type?.completed),
      homeScore: scoreFromCompetitor(home),
      awayScore: scoreFromCompetitor(away),
      statusDetail: competition?.status?.type?.shortDetail || competition?.status?.type?.detail || null,
      statusState: competition?.status?.type?.state || null,
      possessionSide,
      situationText,
      redZone: Boolean(situation?.isRedZone),
      down,
      distance,
      yardsToGoal,
      homeTimeouts: finiteSituationNumber(situation?.homeTimeouts),
      awayTimeouts: finiteSituationNumber(situation?.awayTimeouts),
      homeTeam: teamFromCompetitor(home),
      awayTeam: teamFromCompetitor(away)
    }];
  });
}

export function resolveEspnCommenceTime(match: EspnScheduleMatch, fallbackIso: string, timezone = "America/Chicago") {
  if (match.game.timeValid) return match.game.commenceTime;

  const officialDate = new Date(match.game.commenceTime);
  const fallbackLocal = toZonedTime(new Date(fallbackIso), timezone);
  const year = officialDate.getUTCFullYear();
  const month = String(officialDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(officialDate.getUTCDate()).padStart(2, "0");
  const hour = String(fallbackLocal.getHours()).padStart(2, "0");
  const minute = String(fallbackLocal.getMinutes()).padStart(2, "0");
  const second = String(fallbackLocal.getSeconds()).padStart(2, "0");
  return fromZonedTime(`${year}-${month}-${day}T${hour}:${minute}:${second}`, timezone).toISOString();
}

export function findEspnScheduleMatch(matchup: Matchup, schedule: EspnScheduleGame[], options: { allowOneSided?: boolean } = {}): EspnScheduleMatch | null {
  const allowOneSided = options.allowOneSided !== false;
  const sourceTime = new Date(matchup.commence_time).getTime();

  // Games imported from the odds job already have a verified ESPN event id.
  // Prefer that stable identity over dates/team-name heuristics whenever it is available.
  if (matchup.espn_event_id) {
    const exact = schedule.find((game) => game.id === matchup.espn_event_id);
    if (exact) {
      const distance = Math.abs(new Date(exact.commenceTime).getTime() - sourceTime);
      const directScore = alignmentScore(
        identityScore(matchup.home_team, exact.homeTeam),
        identityScore(matchup.away_team, exact.awayTeam),
        distance,
        true
      );
      const swappedScore = alignmentScore(
        identityScore(matchup.home_team, exact.awayTeam),
        identityScore(matchup.away_team, exact.homeTeam),
        distance,
        true
      );
      return { game: exact, swapped: swappedScore > directScore };
    }

    // A stored ESPN event id is the stable identity for this game. If that
    // event is temporarily absent from the provider response, fail closed and
    // wait for the next poll instead of attaching a different game's score via
    // a fuzzy team-name fallback.
    return null;
  }

  let best: { score: number; distance: number; match: EspnScheduleMatch } | null = null;

  for (const game of schedule) {
    const distance = Math.abs(new Date(game.commenceTime).getTime() - sourceTime);
    const directHome = identityScore(matchup.home_team, game.homeTeam);
    const directAway = identityScore(matchup.away_team, game.awayTeam);
    const swappedHome = identityScore(matchup.home_team, game.awayTeam);
    const swappedAway = identityScore(matchup.away_team, game.homeTeam);
    const directScore = alignmentScore(directHome, directAway, distance, allowOneSided);
    const swappedScore = alignmentScore(swappedHome, swappedAway, distance, allowOneSided);
    const score = Math.max(directScore, swappedScore);
    if (!score) continue;

    const candidate = {
      score,
      distance,
      match: { game, swapped: swappedScore > directScore }
    };
    if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.distance < best.distance)) {
      best = candidate;
    }
  }

  return best?.match || null;
}

export async function resolveEspnScheduleMatch(
  matchup: Matchup,
  schedule: EspnScheduleGame[],
  league: "NFL" | "CFB",
  options: { allowOneSided?: boolean; freshness?: boolean | number } = {}
): Promise<EspnScheduleMatch | null> {
  const match = findEspnScheduleMatch(matchup, schedule, options);
  if (match || !matchup.espn_event_id) return match;

  // The date scoreboard occasionally omits individual games. When we already
  // know ESPN's event id, query that exact event instead of guessing from a
  // different matchup or leaving a valid game stuck on "Score updating."
  const exact = await fetchEspnEvent(league, matchup.espn_event_id, options.freshness ?? true);
  return exact ? findEspnScheduleMatch(matchup, [exact], options) : null;
}
