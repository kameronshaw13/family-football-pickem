import { getSupabaseAdmin } from "@/lib/supabaseServer";
import { normalizeTeamNameKey, teamDisplayName } from "@/lib/teamNames";
import { createAsyncCache } from "@/lib/asyncCache";
import { parseCsv, finiteNumber, type SportsDataRow } from "@/lib/cfbMatchupData";

type NflLocalGame = {
  id: string;
  espn_event_id?: string | null;
  week: number;
  commence_time: string;
  home_team: string;
  away_team: string;
  current_spread_team: string | null;
  current_spread: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
};

export type NflMatchupGame = NflLocalGame & {
  league: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
};

type MetricUnit = {
  epaPerPlay: number | null;
  epaPerPlayRank: number | null;
  passEpaPerDropback: number | null;
  passEpaPerDropbackRank: number | null;
  rushEpaPerCarry: number | null;
  rushEpaPerCarryRank: number | null;
  cpoe: number | null;
  cpoeRank: number | null;
  explosiveRate: number | null;
  explosiveRateRank: number | null;
  yardsPerPlay: number | null;
  yardsPerPlayRank: number | null;
  firstDownRate: number | null;
  firstDownRateRank: number | null;
  turnoverRate: number | null;
  turnoverRateRank: number | null;
};

type Aggregate = {
  games: number;
  plays: number;
  dropbacks: number;
  carries: number;
  passEpa: number;
  rushEpa: number;
  cpoeWeighted: number;
  cpoeAttempts: number;
  explosivePlays: number;
  passingYards: number;
  rushingYards: number;
  firstDowns: number;
  turnovers: number;
};

const statsCache = createAsyncCache<SportsDataRow[]>(15 * 60_000, 4);
const previewCache = createAsyncCache<Awaited<ReturnType<typeof buildMatchup>>>(5 * 60_000, 64);

const NFL_CODES: Record<string, string> = {
  "arizona cardinals": "ARI",
  "atlanta falcons": "ATL",
  "baltimore ravens": "BAL",
  "buffalo bills": "BUF",
  "carolina panthers": "CAR",
  "chicago bears": "CHI",
  "cincinnati bengals": "CIN",
  "cleveland browns": "CLE",
  "dallas cowboys": "DAL",
  "denver broncos": "DEN",
  "detroit lions": "DET",
  "green bay packers": "GB",
  "houston texans": "HOU",
  "indianapolis colts": "IND",
  "jacksonville jaguars": "JAX",
  "kansas city chiefs": "KC",
  "las vegas raiders": "LV",
  "los angeles chargers": "LAC",
  "los angeles rams": "LAR",
  "miami dolphins": "MIA",
  "minnesota vikings": "MIN",
  "new england patriots": "NE",
  "new orleans saints": "NO",
  "new york giants": "NYG",
  "new york jets": "NYJ",
  "philadelphia eagles": "PHI",
  "pittsburgh steelers": "PIT",
  "san francisco 49ers": "SF",
  "seattle seahawks": "SEA",
  "tampa bay buccaneers": "TB",
  "tennessee titans": "TEN",
  "washington commanders": "WAS"
};

function seasonFor(game: NflMatchupGame) {
  const date = new Date(game.commence_time);
  return date.getUTCMonth() < 2 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

function teamCode(team: string) {
  return NFL_CODES[normalizeTeamNameKey(team)] || null;
}

function sameTeam(a: string | null | undefined, b: string | null | undefined) {
  return Boolean(a && b && normalizeTeamNameKey(a) === normalizeTeamNameKey(b));
}

function number(row: SportsDataRow, key: string) {
  return finiteNumber(row[key]) ?? 0;
}

async function fetchWeeklyTeamStats(season: number) {
  return statsCache(String(season), async () => {
    const keep = new Set([
      "season", "week", "season_type", "team", "opponent_team",
      "attempts", "carries", "sacks_suffered", "passing_epa", "rushing_epa", "passing_cpoe",
      "passing_20", "rushing_20", "passing_yards", "rushing_yards",
      "passing_first_downs", "rushing_first_downs",
      "passing_interceptions", "sack_fumbles_lost", "rushing_fumbles_lost"
    ]);
    const response = await fetch(
      `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`,
      { next: { revalidate: 15 * 60 }, signal: AbortSignal.timeout(10_000) }
    );
    if (!response.ok) throw new Error(`NFL advanced stats unavailable (${response.status})`);
    return parseCsv(await response.text(), (header) => keep.has(header));
  });
}

function rowsThroughWeek(rows: SportsDataRow[], throughWeek: number) {
  return rows.filter((row) => {
    const week = finiteNumber(row.week);
    const seasonType = String(row.season_type || "").toUpperCase();
    return week != null && week <= throughWeek && (!seasonType || seasonType === "REG");
  });
}

function aggregate(rows: SportsDataRow[]): Aggregate {
  return rows.reduce<Aggregate>((sum, row) => {
    const attempts = number(row, "attempts");
    const carries = number(row, "carries");
    const sacks = number(row, "sacks_suffered");
    const cpoe = finiteNumber(row.passing_cpoe);
    sum.games += 1;
    sum.dropbacks += attempts + sacks;
    sum.carries += carries;
    sum.plays += attempts + sacks + carries;
    sum.passEpa += number(row, "passing_epa");
    sum.rushEpa += number(row, "rushing_epa");
    if (cpoe != null && attempts > 0) {
      sum.cpoeWeighted += cpoe * attempts;
      sum.cpoeAttempts += attempts;
    }
    sum.explosivePlays += number(row, "passing_20") + number(row, "rushing_20");
    sum.passingYards += number(row, "passing_yards");
    sum.rushingYards += number(row, "rushing_yards");
    sum.firstDowns += number(row, "passing_first_downs") + number(row, "rushing_first_downs");
    sum.turnovers += number(row, "passing_interceptions") + number(row, "sack_fumbles_lost") + number(row, "rushing_fumbles_lost");
    return sum;
  }, {
    games: 0, plays: 0, dropbacks: 0, carries: 0, passEpa: 0, rushEpa: 0,
    cpoeWeighted: 0, cpoeAttempts: 0, explosivePlays: 0, passingYards: 0,
    rushingYards: 0, firstDowns: 0, turnovers: 0
  });
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function values(agg: Aggregate) {
  return {
    epaPerPlay: ratio(agg.passEpa + agg.rushEpa, agg.plays),
    passEpaPerDropback: ratio(agg.passEpa, agg.dropbacks),
    rushEpaPerCarry: ratio(agg.rushEpa, agg.carries),
    cpoe: ratio(agg.cpoeWeighted, agg.cpoeAttempts),
    explosiveRate: ratio(agg.explosivePlays, agg.plays),
    yardsPerPlay: ratio(agg.passingYards + agg.rushingYards, agg.plays),
    firstDownRate: ratio(agg.firstDowns, agg.plays),
    turnoverRate: ratio(agg.turnovers, agg.plays)
  };
}

type ValueKey = keyof ReturnType<typeof values>;

function rankFor(all: Array<{ code: string; value: number | null }>, code: string, higherBetter: boolean) {
  const valid = all.filter((row): row is { code: string; value: number } => row.value != null && Number.isFinite(row.value));
  valid.sort((a, b) => higherBetter ? b.value - a.value : a.value - b.value);
  const index = valid.findIndex((row) => row.code === code);
  return index >= 0 ? index + 1 : null;
}

function unitFor(code: string, side: "offense" | "defense", teamRows: SportsDataRow[]) : MetricUnit | null {
  const codes = Array.from(new Set(teamRows.map((row) => String(row.team || "")).filter(Boolean)));
  if (!codes.includes(code)) return null;
  const aggregateFor = (candidate: string) => aggregate(teamRows.filter((row) =>
    side === "offense" ? String(row.team || "") === candidate : String(row.opponent_team || "") === candidate
  ));
  const candidateAggregates = new Map(codes.map((candidate) => [candidate, aggregateFor(candidate)]));
  const target = candidateAggregates.get(code);
  if (!target || !target.games) return null;
  const targetValues = values(target);

  const rank = (key: ValueKey, higherBetter: boolean) => rankFor(
    codes.map((candidate) => ({ code: candidate, value: values(candidateAggregates.get(candidate)!)[key] })),
    code,
    higherBetter
  );

  return {
    epaPerPlay: targetValues.epaPerPlay,
    epaPerPlayRank: rank("epaPerPlay", side === "offense"),
    passEpaPerDropback: targetValues.passEpaPerDropback,
    passEpaPerDropbackRank: rank("passEpaPerDropback", side === "offense"),
    rushEpaPerCarry: targetValues.rushEpaPerCarry,
    rushEpaPerCarryRank: rank("rushEpaPerCarry", side === "offense"),
    cpoe: targetValues.cpoe,
    cpoeRank: rank("cpoe", side === "offense"),
    explosiveRate: targetValues.explosiveRate,
    explosiveRateRank: rank("explosiveRate", side === "offense"),
    yardsPerPlay: targetValues.yardsPerPlay,
    yardsPerPlayRank: rank("yardsPerPlay", side === "offense"),
    firstDownRate: targetValues.firstDownRate,
    firstDownRateRank: rank("firstDownRate", side === "offense"),
    turnoverRate: targetValues.turnoverRate,
    turnoverRateRank: rank("turnoverRate", side === "defense")
  };
}

function dedupeGames(games: NflLocalGame[]) {
  const byKey = new Map<string, NflLocalGame>();
  for (const game of games) {
    const key = game.espn_event_id || [
      game.commence_time,
      normalizeTeamNameKey(game.away_team),
      normalizeTeamNameKey(game.home_team)
    ].join(":");
    const existing = byKey.get(key);
    if (!existing || (existing.final_home_score == null && game.final_home_score != null)) byKey.set(key, game);
  }
  return Array.from(byKey.values()).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

function localGamesForTeam(games: NflLocalGame[], team: string, targetDate: number) {
  return games.filter((game) =>
    new Date(game.commence_time).getTime() < targetDate &&
    game.final_home_score != null &&
    game.final_away_score != null &&
    (sameTeam(game.home_team, team) || sameTeam(game.away_team, team))
  );
}

function summarizeResults(games: NflLocalGame[], team: string) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const recent = games.slice().reverse().map((game) => {
    const home = sameTeam(game.home_team, team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    const opponent = home ? game.away_team : game.home_team;
    const margin = teamPoints - opponentPoints;
    if (margin > 0) wins += 1;
    else if (margin < 0) losses += 1;
    else ties += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
    return {
      id: game.id,
      week: game.week,
      date: game.commence_time,
      opponent,
      home,
      teamPoints,
      opponentPoints,
      margin,
      result: margin > 0 ? "W" as const : margin < 0 ? "L" as const : "T" as const
    };
  });
  const count = games.length;
  return {
    record: { wins, losses, ties },
    scoring: {
      ppg: count ? pointsFor / count : null,
      allowedPpg: count ? pointsAgainst / count : null,
      margin: count ? (pointsFor - pointsAgainst) / count : null
    },
    recent
  };
}

function summarizeAts(games: NflLocalGame[], team: string) {
  const recent = games.slice().reverse().flatMap((game) => {
    if (game.current_spread == null || !game.current_spread_team) return [];
    const spread = Number(game.current_spread);
    if (!Number.isFinite(spread)) return [];
    const teamSpread = sameTeam(game.current_spread_team, team) ? spread : -spread;
    const home = sameTeam(game.home_team, team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    const coverMargin = teamPoints - opponentPoints + teamSpread;
    return [{
      id: game.id,
      week: game.week,
      date: game.commence_time,
      opponent: home ? game.away_team : game.home_team,
      home,
      spread: teamSpread,
      teamPoints,
      opponentPoints,
      coverMargin,
      result: Math.abs(coverMargin) < 0.001 ? "P" as const : coverMargin > 0 ? "W" as const : "L" as const
    }];
  });
  const wins = recent.filter((game) => game.result === "W").length;
  const losses = recent.filter((game) => game.result === "L").length;
  const pushes = recent.filter((game) => game.result === "P").length;
  return {
    wins, losses, pushes,
    avgCoverMargin: recent.length ? recent.reduce((sum, game) => sum + game.coverMargin, 0) / recent.length : null,
    recent
  };
}

async function buildMatchup(game: NflMatchupGame) {
  const season = seasonFor(game);
  const throughWeek = Math.max(0, game.week - 1);
  const targetDate = new Date(game.commence_time).getTime();
  const supabase = getSupabaseAdmin();
  const [statsResult, localResult] = await Promise.allSettled([
    fetchWeeklyTeamStats(season),
    supabase.from("games")
      .select("id,espn_event_id,week,commence_time,home_team,away_team,current_spread_team,current_spread,final_home_score,final_away_score")
      .eq("league", "NFL")
      .gte("commence_time", `${season}-08-01T00:00:00Z`)
      .lt("commence_time", game.commence_time)
      .order("commence_time", { ascending: true })
      .limit(250)
      .abortSignal(AbortSignal.timeout(8_000))
  ]);

  const stats = statsResult.status === "fulfilled" ? rowsThroughWeek(statsResult.value, throughWeek) : [];
  const localRows = localResult.status === "fulfilled" && !localResult.value.error
    ? dedupeGames((localResult.value.data || []) as NflLocalGame[])
    : [];
  const awayCode = teamCode(game.away_team);
  const homeCode = teamCode(game.home_team);

  const makeTeam = (team: string, code: string | null) => {
    const teamGames = localGamesForTeam(localRows, team, targetDate);
    const result = summarizeResults(teamGames, team);
    const ats = summarizeAts(teamGames, team);
    const offenseAggregate = code ? aggregate(stats.filter((row) => String(row.team || "") === code)) : aggregate([]);
    return {
      name: teamDisplayName("NFL", team),
      fullName: team,
      code,
      ...result,
      ats,
      regular: {
        yardsPerGame: offenseAggregate.games ? (offenseAggregate.passingYards + offenseAggregate.rushingYards) / offenseAggregate.games : null,
        passYardsPerGame: offenseAggregate.games ? offenseAggregate.passingYards / offenseAggregate.games : null,
        rushYardsPerGame: offenseAggregate.games ? offenseAggregate.rushingYards / offenseAggregate.games : null,
        turnoversPerGame: offenseAggregate.games ? offenseAggregate.turnovers / offenseAggregate.games : null
      },
      relative: code && stats.length ? {
        offense: unitFor(code, "offense", stats),
        defense: unitFor(code, "defense", stats)
      } : null,
      resultsAvailable: teamGames.length > 0
    };
  };

  return {
    season,
    throughWeek,
    fetchedAt: new Date().toISOString(),
    source: stats.length ? "nflverse" : "results-only",
    advancedAvailable: Boolean(stats.length && awayCode && homeCode),
    teams: {
      away: makeTeam(game.away_team, awayCode),
      home: makeTeam(game.home_team, homeCode)
    }
  };
}

export type NflMatchupPayload = Awaited<ReturnType<typeof buildMatchup>>;
export type NflMatchupTeam = NflMatchupPayload["teams"]["away"];

export function loadNflMatchup(game: NflMatchupGame) {
  return previewCache(`${game.id}:${game.week}:${game.commence_time}`, () => buildMatchup(game));
}
