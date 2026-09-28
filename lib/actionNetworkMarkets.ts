import type { Game, SideBetMarketQuote, SideBetOfferPhase } from "@/lib/types";

const ACTION_BASE = "https://api.actionnetwork.com/web/v1/scoreboard";
const ACTION_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DRAFTKINGS_BOOK_ID = 68;
const LIVE_MAX_AGE_SECONDS = 45;

type ActionTeam = {
  id?: number | string;
  full_name?: string;
  display_name?: string;
  short_name?: string;
  name?: string;
  abbr?: string;
};

type ActionOddsRow = {
  book_id?: number;
  type?: string;
  inserted?: string;
  ml_home?: number | string | null;
  ml_away?: number | string | null;
  spread_home?: number | string | null;
  spread_away?: number | string | null;
  spread_home_line?: number | string | null;
  spread_away_line?: number | string | null;
  total?: number | string | null;
  over?: number | string | null;
  under?: number | string | null;
  line_status?: Record<string, number | string | null>;
};

type ActionGame = {
  id?: number | string;
  status?: string;
  start_time?: string;
  home_team_id?: number | string;
  away_team_id?: number | string;
  teams?: ActionTeam[];
  odds?: ActionOddsRow[];
};

function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}${part("month")}${part("day")}`;
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliases(team: ActionTeam | undefined) {
  if (!team) return [];
  return [team.full_name, team.display_name, team.short_name, team.name, team.abbr]
    .filter((value): value is string => Boolean(value))
    .map(normalizeName)
    .filter(Boolean);
}

function teamMatchScore(expected: string, candidates: string[]) {
  const normalized = normalizeName(expected);
  if (!normalized) return 0;
  let best = 0;
  const expectedTokens = new Set(normalized.split(" ").filter((token) => token.length > 2));
  for (const candidate of candidates) {
    if (candidate === normalized) best = Math.max(best, 100);
    else if (candidate.length >= 5 && (candidate.includes(normalized) || normalized.includes(candidate))) best = Math.max(best, 82);
    const tokens = new Set(candidate.split(" ").filter((token) => token.length > 2));
    let common = 0;
    for (const token of expectedTokens) if (tokens.has(token)) common += 1;
    if (common >= 2) best = Math.max(best, 45 + common * 8);
    else if (common === 1 && expectedTokens.size === 1) best = Math.max(best, 48);
  }
  return best;
}

function actionTeams(game: ActionGame) {
  const byId = new Map((game.teams || []).map((team) => [String(team.id), team]));
  return {
    home: byId.get(String(game.home_team_id)),
    away: byId.get(String(game.away_team_id))
  };
}

function actionMatchScore(game: Game, actionGame: ActionGame) {
  const teams = actionTeams(actionGame);
  const homeScore = teamMatchScore(game.home_team, aliases(teams.home));
  const awayScore = teamMatchScore(game.away_team, aliases(teams.away));
  if (homeScore < 45 || awayScore < 45) return 0;

  const expectedStart = new Date(game.commence_time).getTime();
  const actionStart = new Date(actionGame.start_time || 0).getTime();
  const timeDelta = Number.isFinite(expectedStart) && Number.isFinite(actionStart)
    ? Math.abs(expectedStart - actionStart)
    : 0;
  if (timeDelta > 12 * 60 * 60 * 1000) return 0;
  const timeBonus = timeDelta <= 20 * 60 * 1000 ? 25 : timeDelta <= 2 * 60 * 60 * 1000 ? 10 : 0;
  return homeScore + awayScore + timeBonus;
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validOdds(value: unknown) {
  const odds = finiteNumber(value);
  return odds != null && Number.isInteger(odds) && (odds <= -100 || odds >= 100) ? odds : null;
}

function suspended(row: ActionOddsRow, ...fields: string[]) {
  const status = row.line_status || {};
  return fields.some((field) => Number(status[field]) === 2);
}

function rowAgeSeconds(row: ActionOddsRow, now = Date.now()) {
  if (!row.inserted) return null;
  const inserted = new Date(row.inserted).getTime();
  return Number.isFinite(inserted) ? (now - inserted) / 1000 : null;
}

async function fetchActionLeague(league: Game["league"]) {
  const path = league === "NFL" ? "nfl" : "ncaaf";
  const params = new URLSearchParams({
    bookIds: String(DRAFTKINGS_BOOK_ID),
    date: dateKey(),
    periods: "event"
  });
  if (league === "CFB") params.set("division", "FBS");
  const response = await fetch(`${ACTION_BASE}/${path}?${params.toString()}`, {
    headers: { "User-Agent": ACTION_USER_AGENT },
    next: { revalidate: 5 }
  });
  if (!response.ok) throw new Error(`Action Network ${league} market request failed with ${response.status}.`);
  const payload = await response.json();
  return Array.isArray(payload?.games) ? payload.games as ActionGame[] : [];
}

function quoteForGame(game: Game, actionGames: ActionGame[]): SideBetMarketQuote | null {
  let matched: ActionGame | null = null;
  let bestScore = 0;
  for (const actionGame of actionGames) {
    const score = actionMatchScore(game, actionGame);
    if (score > bestScore) {
      bestScore = score;
      matched = actionGame;
    }
  }
  if (!matched || bestScore < 90) return null;

  const phase: SideBetOfferPhase | null = matched.status === "scheduled"
    ? "pregame"
    : matched.status === "inprogress"
      ? "live"
      : null;
  if (!phase) return null;

  const wantedType = phase === "live" ? "live" : "game";
  const rows = (matched.odds || [])
    .filter((row) => Number(row.book_id) === DRAFTKINGS_BOOK_ID && row.type === wantedType)
    .filter((row) => phase !== "live" || (() => {
      const age = rowAgeSeconds(row);
      return age != null && age >= -5 && age <= LIVE_MAX_AGE_SECONDS;
    })())
    .sort((a, b) => new Date(b.inserted || 0).getTime() - new Date(a.inserted || 0).getTime());
  const row = rows[0];
  if (!row) return null;

  const awaySpread = finiteNumber(row.spread_away);
  const homeSpread = finiteNumber(row.spread_home);
  const spreadSuspended = suspended(row, "spread_away", "spread_home");
  const mlSuspended = suspended(row, "ml_away", "ml_home");
  const totalSuspended = suspended(row, "over", "under");

  const total = finiteNumber(row.total);
  return {
    gameId: game.id,
    phase,
    status: String(matched.status || ""),
    spread: awaySpread != null && homeSpread != null ? {
      awayPoint: awaySpread,
      homePoint: homeSpread,
      awayOdds: validOdds(row.spread_away_line),
      homeOdds: validOdds(row.spread_home_line),
      suspended: spreadSuspended
    } : null,
    moneyline: validOdds(row.ml_away) != null && validOdds(row.ml_home) != null ? {
      awayOdds: validOdds(row.ml_away)!,
      homeOdds: validOdds(row.ml_home)!,
      suspended: mlSuspended
    } : null,
    total: total != null ? {
      points: total,
      overOdds: validOdds(row.over),
      underOdds: validOdds(row.under),
      suspended: totalSuspended
    } : null
  };
}

export async function fetchActionNetworkMarkets(games: Game[]) {
  const leagues = Array.from(new Set(games.map((game) => game.league)));
  const leaguePayloads = new Map<Game["league"], ActionGame[]>();
  await Promise.all(leagues.map(async (league) => {
    try {
      leaguePayloads.set(league, await fetchActionLeague(league));
    } catch (error) {
      console.error(`[side-bet-markets] ${league} fetch failed`, error);
      leaguePayloads.set(league, []);
    }
  }));

  return games.flatMap((game) => {
    const quote = quoteForGame(game, leaguePayloads.get(game.league) || []);
    return quote ? [quote] : [];
  });
}

export async function fetchActionNetworkMarketForGame(game: Game, phase: SideBetOfferPhase) {
  const quotes = await fetchActionNetworkMarkets([game]);
  return quotes.find((quote) => quote.gameId === game.id && quote.phase === phase) || null;
}

export function actionMarketAvailable(quote: SideBetMarketQuote | null, marketType: "spread" | "moneyline" | "total") {
  if (!quote) return false;
  if (marketType === "spread") return Boolean(quote.spread && !quote.spread.suspended);
  if (marketType === "moneyline") return Boolean(quote.moneyline && !quote.moneyline.suspended);
  return Boolean(quote.total && !quote.total.suspended);
}
