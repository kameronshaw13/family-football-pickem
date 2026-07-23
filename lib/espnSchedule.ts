import { fromZonedTime, toZonedTime } from "date-fns-tz";

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
  homeTeam: EspnTeam;
  awayTeam: EspnTeam;
};

export type EspnScheduleMatch = {
  game: EspnScheduleGame;
  swapped: boolean;
};

type Matchup = {
  commence_time: string;
  home_team: string;
  away_team: string;
};

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/hawai[\s'’`-]*i/g, "hawaii")
    .replace(/\bst\.?\b/g, "state")
    .replace(/\bmississippi\b/g, "miss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function includesAll(haystack: Set<string>, needles: Set<string>) {
  return needles.size > 0 && Array.from(needles).every((token) => haystack.has(token));
}

function identityScore(sourceName: string, team: EspnTeam) {
  const source = normalize(sourceName);
  const aliases = [team.displayName, `${team.location} ${team.nickname}`, team.location, team.abbreviation]
    .map(normalize)
    .filter(Boolean);
  if (aliases.includes(source)) return 120;

  const sourceTokens = tokenSet(source);
  const locationTokens = tokenSet(team.location);
  const nicknameTokens = tokenSet(team.nickname);
  if (includesAll(sourceTokens, locationTokens) && includesAll(sourceTokens, nicknameTokens)) return 110;
  if (locationTokens.size >= 2 && includesAll(sourceTokens, locationTokens)) return 95;

  const displayTokens = tokenSet(team.displayName);
  const overlap = Array.from(displayTokens).filter((token) => sourceTokens.has(token)).length;
  return overlap >= 2 ? Math.round((overlap / Math.max(displayTokens.size, sourceTokens.size)) * 80) : 0;
}

function teamFromCompetitor(competitor: any): EspnTeam {
  const team = competitor?.team || {};
  return {
    displayName: team.displayName || "",
    location: team.location || team.shortDisplayName || "",
    nickname: team.name || "",
    abbreviation: team.abbreviation || "",
    logoUrl: team.logo || team.logos?.[0]?.href || null
  };
}

function compactDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function fetchEspnSchedule(league: "NFL" | "CFB", dateHints: string[]) {
  const parsedDates = dateHints.map((date) => new Date(date)).filter((date) => !Number.isNaN(date.getTime()));
  if (!parsedDates.length) return [];

  const min = new Date(Math.min(...parsedDates.map((date) => date.getTime())));
  const max = new Date(Math.max(...parsedDates.map((date) => date.getTime())));
  min.setUTCDate(min.getUTCDate() - 3);
  max.setUTCDate(max.getUTCDate() + 3);

  const sportPath = league === "NFL" ? "nfl" : "college-football";
  const url = new URL(`https://site.api.espn.com/apis/site/v2/sports/football/${sportPath}/scoreboard`);
  url.searchParams.set("limit", "1000");
  url.searchParams.set("dates", `${compactDate(min)}-${compactDate(max)}`);

  const response = await fetch(url.toString(), { next: { revalidate: 60 * 60 } });
  if (!response.ok) throw new Error(`ESPN schedule failed for ${league}.`);
  const payload = await response.json();

  return (payload?.events || []).flatMap((event: any): EspnScheduleGame[] => {
    const competition = event?.competitions?.[0];
    const home = competition?.competitors?.find((competitor: any) => competitor.homeAway === "home");
    const away = competition?.competitors?.find((competitor: any) => competitor.homeAway === "away");
    const commenceTime = competition?.date || event?.date;
    if (!home || !away || !commenceTime) return [];
    return [{
      id: String(event.id),
      commenceTime,
      timeValid: competition?.timeValid !== false,
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

export function findEspnScheduleMatch(matchup: Matchup, schedule: EspnScheduleGame[]): EspnScheduleMatch | null {
  let best: { score: number; distance: number; match: EspnScheduleMatch } | null = null;
  const sourceTime = new Date(matchup.commence_time).getTime();

  for (const game of schedule) {
    const directHome = identityScore(matchup.home_team, game.homeTeam);
    const directAway = identityScore(matchup.away_team, game.awayTeam);
    const swappedHome = identityScore(matchup.home_team, game.awayTeam);
    const swappedAway = identityScore(matchup.away_team, game.homeTeam);
    const directScore = Math.min(directHome, directAway) >= 80 ? directHome + directAway : 0;
    const swappedScore = Math.min(swappedHome, swappedAway) >= 80 ? swappedHome + swappedAway : 0;
    const score = Math.max(directScore, swappedScore);
    if (!score) continue;

    const candidate = {
      score,
      distance: Math.abs(new Date(game.commenceTime).getTime() - sourceTime),
      match: { game, swapped: swappedScore > directScore }
    };
    if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.distance < best.distance)) {
      best = candidate;
    }
  }

  return best?.match || null;
}
