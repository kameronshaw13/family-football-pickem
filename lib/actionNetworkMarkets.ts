import type { Game, SideBetMarketQuote, SideBetOfferPhase } from "@/lib/types";

const ACTION_BASE = "https://api.actionnetwork.com/web/v1/scoreboard";
const ACTION_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DRAFTKINGS_BOOK_ID = 68;
const ACTION_FALLBACK_BOOK_IDS = [DRAFTKINGS_BOOK_ID, 15, 30, 75, 123];
const LIVE_MAX_AGE_SECONDS = 45;
const ACTION_CACHE_MS = 5_000;
const actionLeagueRequestCache = new Map<string, { expiresAt: number; promise: Promise<ActionGame[]> }>();

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

export type ActionNetworkScheduledGame = {
  actionId: string;
  league: Game["league"];
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  homeAliases: string[];
  awayAliases: string[];
  spread: {
    awayPoint: number;
    homePoint: number;
    awayOdds: number | null;
    homeOdds: number | null;
    suspended: boolean;
  } | null;
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

function rawAliases(team: ActionTeam | undefined) {
  if (!team) return [];
  return [team.full_name, team.display_name, team.short_name, team.name, team.abbr]
    .filter((value): value is string => Boolean(value));
}

function aliases(team: ActionTeam | undefined) {
  return rawAliases(team).map(normalizeName).filter(Boolean);
}

function primaryTeamName(team: ActionTeam | undefined) {
  return team?.full_name || team?.display_name || team?.short_name || team?.name || team?.abbr || "";
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

function bookPriority(row: ActionOddsRow) {
  const bookId = Number(row.book_id);
  if (bookId === DRAFTKINGS_BOOK_ID) return 0;
  if (bookId === 15) return 1; // Action consensus is the safest full-game fallback.
  return 2;
}

function sortPreferredMarketRows(rows: ActionOddsRow[]) {
  return [...rows].sort((a, b) => {
    const priority = bookPriority(a) - bookPriority(b);
    if (priority !== 0) return priority;
    return new Date(b.inserted || 0).getTime() - new Date(a.inserted || 0).getTime();
  });
}

function marketRowsForPhase(game: ActionGame, phase: SideBetOfferPhase) {
  const rows = (game.odds || [])
    .filter((row) => phase === "live" ? row.type === "live" : row.type === "game")
    .filter((row) => phase !== "live" || (() => {
      const age = rowAgeSeconds(row);
      return age != null && age <= LIVE_MAX_AGE_SECONDS;
    })());

  return sortPreferredMarketRows(rows);
}

function spreadRow(rows: ActionOddsRow[]) {
  return rows.find((row) =>
    finiteNumber(row.spread_away) != null &&
    finiteNumber(row.spread_home) != null
  ) || null;
}

function moneylineRow(rows: ActionOddsRow[]) {
  return rows.find((row) =>
    validOdds(row.ml_away) != null &&
    validOdds(row.ml_home) != null
  ) || null;
}

function totalRow(rows: ActionOddsRow[]) {
  return rows.find((row) => finiteNumber(row.total) != null) || null;
}

async function fetchActionLeagueDate(league: Game["league"], marketDate: string) {
  const cacheKey = `${league}:${marketDate}`;
  const now = Date.now();
  const cached = actionLeagueRequestCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise;

  const request = (async () => {
    const path = league === "NFL" ? "nfl" : "ncaaf";
    const params = new URLSearchParams({
      bookIds: ACTION_FALLBACK_BOOK_IDS.join(","),
      date: marketDate,
      periods: "event"
    });
    if (league === "CFB") params.set("division", "FBS");
    const response = await fetch(`${ACTION_BASE}/${path}?${params.toString()}`, {
      headers: { "User-Agent": ACTION_USER_AGENT },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Action Network ${league} market request failed with ${response.status} for ${marketDate}.`);
    const payload = await response.json();
    return Array.isArray(payload?.games) ? payload.games as ActionGame[] : [];
  })();

  actionLeagueRequestCache.set(cacheKey, { expiresAt: now + ACTION_CACHE_MS, promise: request });
  try {
    return await request;
  } catch (error) {
    actionLeagueRequestCache.delete(cacheKey);
    throw error;
  }
}

async function fetchActionLeague(league: Game["league"], games: Game[]) {
  const marketDates = Array.from(new Set(games.map((game) => dateKey(new Date(game.commence_time)))));
  const results = await Promise.allSettled(marketDates.map((marketDate) => fetchActionLeagueDate(league, marketDate)));
  const successful = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!successful.length && results.some((result) => result.status === "rejected")) {
    const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    throw firstFailure?.reason instanceof Error ? firstFailure.reason : new Error(`Action Network ${league} market request failed.`);
  }
  return Array.from(new Map(successful.map((game) => [String(game.id || `${game.start_time}:${game.home_team_id}:${game.away_team_id}`), game])).values());
}

export async function fetchActionNetworkScheduledGames(league: Game["league"], dateHints: string[]) {
  const marketDates = Array.from(new Set(dateHints.map((hint) => dateKey(new Date(hint)))));
  const results = await Promise.allSettled(marketDates.map((marketDate) => fetchActionLeagueDate(league, marketDate)));
  const actionGames = Array.from(new Map(
    results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
      .map((game) => [String(game.id || `${game.start_time}:${game.home_team_id}:${game.away_team_id}`), game])
  ).values());

  return actionGames.flatMap((actionGame): ActionNetworkScheduledGame[] => {
    if (!actionGame.start_time) return [];
    const teams = actionTeams(actionGame);
    const homeTeam = primaryTeamName(teams.home);
    const awayTeam = primaryTeamName(teams.away);
    if (!homeTeam || !awayTeam) return [];

    const rows = marketRowsForPhase(actionGame, "pregame");
    const row = spreadRow(rows);
    const awaySpread = finiteNumber(row?.spread_away);
    const homeSpread = finiteNumber(row?.spread_home);

    return [{
      actionId: String(actionGame.id || `${actionGame.start_time}:${actionGame.home_team_id}:${actionGame.away_team_id}`),
      league,
      commenceTime: actionGame.start_time,
      homeTeam,
      awayTeam,
      homeAliases: rawAliases(teams.home),
      awayAliases: rawAliases(teams.away),
      spread: row && awaySpread != null && homeSpread != null ? {
        awayPoint: awaySpread,
        homePoint: homeSpread,
        awayOdds: validOdds(row.spread_away_line),
        homeOdds: validOdds(row.spread_home_line),
        suspended: suspended(row, "spread_away", "spread_home")
      } : null
    }];
  });
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

  const rows = marketRowsForPhase(matched, phase);
  if (!rows.length) return null;

  const spreadMarket = spreadRow(rows);
  const moneylineMarket = moneylineRow(rows);
  const totalMarket = totalRow(rows);

  const awaySpread = finiteNumber(spreadMarket?.spread_away);
  const homeSpread = finiteNumber(spreadMarket?.spread_home);
  const total = finiteNumber(totalMarket?.total);

  const quote: SideBetMarketQuote = {
    gameId: game.id,
    phase,
    status: String(matched.status || ""),
    spread: spreadMarket && awaySpread != null && homeSpread != null ? {
      awayPoint: awaySpread,
      homePoint: homeSpread,
      awayOdds: validOdds(spreadMarket.spread_away_line),
      homeOdds: validOdds(spreadMarket.spread_home_line),
      suspended: suspended(spreadMarket, "spread_away", "spread_home")
    } : null,
    moneyline: moneylineMarket ? {
      awayOdds: validOdds(moneylineMarket.ml_away)!,
      homeOdds: validOdds(moneylineMarket.ml_home)!,
      suspended: suspended(moneylineMarket, "ml_away", "ml_home")
    } : null,
    total: totalMarket && total != null ? {
      points: total,
      overOdds: validOdds(totalMarket.over),
      underOdds: validOdds(totalMarket.under),
      suspended: suspended(totalMarket, "over", "under")
    } : null
  };
  return quote;
}

export async function fetchActionNetworkMarkets(games: Game[]) {
  const leagues = Array.from(new Set(games.map((game) => game.league)));
  const leaguePayloads = new Map<Game["league"], ActionGame[]>();
  await Promise.all(leagues.map(async (league) => {
    try {
      leaguePayloads.set(league, await fetchActionLeague(league, games.filter((game) => game.league === league)));
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
