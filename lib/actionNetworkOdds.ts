import type { Game, League, SideBetMarketQuote } from "@/lib/types";

const ACTION_BASE = "https://api.actionnetwork.com/web/v1/scoreboard";
const ACTION_DK_BOOK_ID = 68;
const ACTION_LIVE_MAX_AGE_MS = 45_000;
const ACTION_CACHE_MS = 5_000;
const ACTION_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

type MarketGame = Pick<Game, "id" | "league" | "commence_time" | "home_team" | "away_team">;

type ActionOddsRow = {
  type?: string;
  book_id?: number;
  inserted?: string;
  line_status?: Record<string, number>;
  spread_away?: number | string | null;
  spread_home?: number | string | null;
  spread_away_line?: number | string | null;
  spread_home_line?: number | string | null;
  ml_away?: number | string | null;
  ml_home?: number | string | null;
  total?: number | string | null;
  over?: number | string | null;
  under?: number | string | null;
};

type ActionGame = {
  id?: string | number;
  status?: string;
  start_time?: string;
  home_team_id?: string | number;
  away_team_id?: string | number;
  teams?: Array<{ id?: string | number; full_name?: string }>;
  odds?: ActionOddsRow[];
};

const responseCache = new Map<string, { at: number; games: ActionGame[] }>();

function actionPath(league: League) {
  return league === "NFL" ? "nfl" : "ncaaf";
}

function actionDate(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}${value("month")}${value("day")}`;
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validPrice(value: number | null) {
  return value != null && Number.isInteger(value) && (value <= -100 || value >= 100);
}

function normalizeTeam(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|university|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamSimilarity(a: string, b: string) {
  const left = normalizeTeam(a);
  const right = normalizeTeam(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function matchupScore(game: MarketGame, candidate: ActionGame) {
  const teams = new Map((candidate.teams || []).map((team) => [String(team.id), team.full_name || ""]));
  const home = teams.get(String(candidate.home_team_id)) || "";
  const away = teams.get(String(candidate.away_team_id)) || "";
  if (!home || !away) return -1;
  const homeScore = teamSimilarity(game.home_team, home);
  const awayScore = teamSimilarity(game.away_team, away);
  if (homeScore < 0.45 || awayScore < 0.45) return -1;
  const sourceStart = candidate.start_time ? new Date(candidate.start_time).getTime() : NaN;
  const gameStart = new Date(game.commence_time).getTime();
  const timePenalty = Number.isFinite(sourceStart) && Number.isFinite(gameStart)
    ? Math.min(Math.abs(sourceStart - gameStart) / (12 * 60 * 60 * 1000), 1) * 0.2
    : 0;
  return homeScore + awayScore - timePenalty;
}

function rowFresh(row: ActionOddsRow) {
  const stamp = row.inserted ? new Date(row.inserted).getTime() : NaN;
  return Number.isFinite(stamp) && Date.now() - stamp <= ACTION_LIVE_MAX_AGE_MS;
}

function suspended(row: ActionOddsRow, ...fields: string[]) {
  const status = row.line_status || {};
  return fields.some((field) => Number(status[field]) === 2);
}

async function fetchScoreboard(league: League, date: string, fresh: boolean) {
  const key = `${league}:${date}`;
  const cached = responseCache.get(key);
  if (!fresh && cached && Date.now() - cached.at < ACTION_CACHE_MS) return cached.games;

  const url = new URL(`${ACTION_BASE}/${actionPath(league)}`);
  url.searchParams.set("bookIds", String(ACTION_DK_BOOK_ID));
  url.searchParams.set("date", date);
  url.searchParams.set("periods", "event");
  if (league === "CFB") url.searchParams.set("division", "FBS");

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: { "User-Agent": ACTION_UA, Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Action Network request failed (${response.status}).`);
  const payload = await response.json() as { games?: ActionGame[] };
  const games = Array.isArray(payload.games) ? payload.games : [];
  responseCache.set(key, { at: Date.now(), games });
  return games;
}

function quoteFromActionGame(game: MarketGame, actionGame: ActionGame): SideBetMarketQuote | null {
  const status = actionGame.status === "inprogress" ? "inprogress" : actionGame.status === "scheduled" ? "scheduled" : null;
  if (!status) return null;
  const wantedType = status === "inprogress" ? "live" : "game";
  const row = (actionGame.odds || []).find((item) =>
    Number(item.book_id) === ACTION_DK_BOOK_ID &&
    item.type === wantedType &&
    (status !== "inprogress" || rowFresh(item))
  );
  if (!row) return null;

  let spreadAway = suspended(row, "spread_away", "spread_home") ? null : numberOrNull(row.spread_away);
  let spreadHome = suspended(row, "spread_away", "spread_home") ? null : numberOrNull(row.spread_home);
  if (spreadHome == null && spreadAway != null) spreadHome = -spreadAway;
  if (spreadAway == null && spreadHome != null) spreadAway = -spreadHome;

  const spreadAwayOddsRaw = suspended(row, "spread_away", "spread_home") ? null : numberOrNull(row.spread_away_line);
  const spreadHomeOddsRaw = suspended(row, "spread_away", "spread_home") ? null : numberOrNull(row.spread_home_line);
  const mlAwayRaw = suspended(row, "ml_away", "ml_home") ? null : numberOrNull(row.ml_away);
  const mlHomeRaw = suspended(row, "ml_away", "ml_home") ? null : numberOrNull(row.ml_home);
  const total = suspended(row, "over", "under") ? null : numberOrNull(row.total);
  const overRaw = suspended(row, "over", "under") ? null : numberOrNull(row.over);
  const underRaw = suspended(row, "over", "under") ? null : numberOrNull(row.under);

  return {
    game_id: game.id,
    status,
    spread_away: spreadAway,
    spread_home: spreadHome,
    spread_away_odds: validPrice(spreadAwayOddsRaw) ? spreadAwayOddsRaw : null,
    spread_home_odds: validPrice(spreadHomeOddsRaw) ? spreadHomeOddsRaw : null,
    moneyline_away: validPrice(mlAwayRaw) ? mlAwayRaw : null,
    moneyline_home: validPrice(mlHomeRaw) ? mlHomeRaw : null,
    total,
    over_odds: validPrice(overRaw) ? overRaw : null,
    under_odds: validPrice(underRaw) ? underRaw : null
  };
}

export async function getActionNetworkQuotes(games: MarketGame[], options: { fresh?: boolean } = {}) {
  const fresh = Boolean(options.fresh);
  const quotes: Record<string, SideBetMarketQuote> = {};
  const eligible = games.filter((game) => game.league === "NFL" || game.league === "CFB");

  for (const league of ["CFB", "NFL"] as const) {
    const leagueGames = eligible.filter((game) => game.league === league);
    if (!leagueGames.length) continue;
    const now = Date.now();
    const sample = [...leagueGames].sort((a, b) =>
      Math.abs(new Date(a.commence_time).getTime() - now) - Math.abs(new Date(b.commence_time).getTime() - now)
    )[0];
    let actionGames: ActionGame[] = [];
    try {
      actionGames = await fetchScoreboard(league, actionDate(sample.commence_time), fresh);
    } catch {
      continue;
    }

    for (const game of leagueGames) {
      let best: ActionGame | null = null;
      let bestScore = -1;
      for (const candidate of actionGames) {
        const score = matchupScore(game, candidate);
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      if (!best || bestScore < 1.15) continue;
      const quote = quoteFromActionGame(game, best);
      if (quote) quotes[game.id] = quote;
    }
  }

  return quotes;
}

export async function getActionNetworkQuoteForGame(game: MarketGame, options: { fresh?: boolean } = {}) {
  const quotes = await getActionNetworkQuotes([game], options);
  return quotes[game.id] || null;
}
