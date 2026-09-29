import { createAsyncCache } from "./asyncCache";
import { finiteNumber, parseCsv, type LocalGame, type SportsDataRow } from "./cfbMatchupData";
import { getSupabaseAdmin } from "./supabaseServer";
import { normalizeTeamNameKey, teamDisplayName } from "./teamNames";

const statsCache = createAsyncCache<SportsDataRow[]>(15 * 60_000, 4);
const previewCache = createAsyncCache<Awaited<ReturnType<typeof buildMatchup>>>(5 * 60_000, 64);
const historyCache = createAsyncCache<Awaited<ReturnType<typeof buildHistory>>>(60 * 60_000, 32);

export type NflMatchupGame = LocalGame & { league: string };
export type NflMatchupPayload = Awaited<ReturnType<typeof buildMatchup>>;
export type NflMatchupTeam = NflMatchupPayload["teams"]["away"];
export type NflMatchupHistory = Awaited<ReturnType<typeof buildHistory>>;

const NFL_ABBR: Record<string, string> = {
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

function nflAbbr(name: string) {
  return NFL_ABBR[normalizeTeamNameKey(name)] || "";
}

function seasonFor(game: NflMatchupGame) {
  const date = new Date(game.commence_time);
  return date.getUTCMonth() < 2 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

async function fetchTeamStats(season: number) {
  return statsCache(String(season), async () => {
    const response = await fetch(
      `https://github.com/nflverse/nflverse-data/releases/download/stats_team/stats_team_week_${season}.csv`,
      { cache: "no-store", signal: AbortSignal.timeout(12_000) }
    );
    if (!response.ok) throw new Error("NFL advanced stats unavailable");
    const keep = new Set([
      "season", "week", "season_type", "team", "opponent_team",
      "attempts", "passing_yards", "passing_epa", "passing_cpoe",
      "passing_interceptions", "passing_first_downs", "passing_20",
      "sacks_suffered", "carries", "rushing_yards", "rushing_epa",
      "rushing_first_downs", "rushing_20", "rushing_fumbles_lost",
      "receiving_fumbles_lost"
    ]);
    return parseCsv(await response.text(), key => keep.has(key));
  });
}

function number(row: SportsDataRow, key: string) {
  return finiteNumber(row[key]) || 0;
}

function aggregate(rows: SportsDataRow[]) {
  const totals = {
    games: rows.length,
    attempts: 0,
    passingYards: 0,
    passingEpa: 0,
    cpoeWeighted: 0,
    cpoeAttempts: 0,
    interceptions: 0,
    passFirstDowns: 0,
    pass20: 0,
    sacks: 0,
    carries: 0,
    rushingYards: 0,
    rushingEpa: 0,
    rushFirstDowns: 0,
    rush20: 0,
    fumblesLost: 0
  };
  for (const row of rows) {
    const attempts = number(row, "attempts");
    totals.attempts += attempts;
    totals.passingYards += number(row, "passing_yards");
    totals.passingEpa += number(row, "passing_epa");
    const cpoe = finiteNumber(row.passing_cpoe);
    if (cpoe != null && attempts > 0) {
      totals.cpoeWeighted += cpoe * attempts;
      totals.cpoeAttempts += attempts;
    }
    totals.interceptions += number(row, "passing_interceptions");
    totals.passFirstDowns += number(row, "passing_first_downs");
    totals.pass20 += number(row, "passing_20");
    totals.sacks += number(row, "sacks_suffered");
    totals.carries += number(row, "carries");
    totals.rushingYards += number(row, "rushing_yards");
    totals.rushingEpa += number(row, "rushing_epa");
    totals.rushFirstDowns += number(row, "rushing_first_downs");
    totals.rush20 += number(row, "rushing_20");
    totals.fumblesLost += number(row, "rushing_fumbles_lost") + number(row, "receiving_fumbles_lost");
  }
  const dropbacks = totals.attempts + totals.sacks;
  const plays = dropbacks + totals.carries;
  const epa = totals.passingEpa + totals.rushingEpa;
  return {
    ...totals,
    dropbacks,
    plays,
    epa,
    epaPerPlay: plays ? epa / plays : null,
    passEpaPerDropback: dropbacks ? totals.passingEpa / dropbacks : null,
    rushEpaPerCarry: totals.carries ? totals.rushingEpa / totals.carries : null,
    yardsPerPlay: plays ? (totals.passingYards + totals.rushingYards) / plays : null,
    explosiveRate: plays ? (totals.pass20 + totals.rush20) / plays : null,
    firstDownRate: plays ? (totals.passFirstDowns + totals.rushFirstDowns) / plays : null,
    turnoverRate: plays ? (totals.interceptions + totals.fumblesLost) / plays : null,
    sackRate: dropbacks ? totals.sacks / dropbacks : null,
    cpoe: totals.cpoeAttempts ? totals.cpoeWeighted / totals.cpoeAttempts : null
  };
}

type Snapshot = ReturnType<typeof aggregate> & {
  epaPerPlayRank: number | null;
  passEpaPerDropbackRank: number | null;
  rushEpaPerCarryRank: number | null;
  yardsPerPlayRank: number | null;
  explosiveRateRank: number | null;
  firstDownRateRank: number | null;
  turnoverRateRank: number | null;
  sackRateRank: number | null;
  cpoeRank: number | null;
};

function rankMap(values: Array<[string, number | null]>, lowerBetter = false) {
  const valid = values.filter((entry): entry is [string, number] => entry[1] != null && Number.isFinite(entry[1]));
  valid.sort((a, b) => lowerBetter ? a[1] - b[1] : b[1] - a[1]);
  return new Map(valid.map(([team], index) => [team, index + 1]));
}

function snapshots(rows: SportsDataRow[], throughWeek: number, defense = false) {
  const filtered = rows.filter(row =>
    String(row.season_type || "").toUpperCase() === "REG" &&
    (finiteNumber(row.week) ?? 99) <= throughWeek
  );
  const teams = Array.from(new Set(filtered.map(row => String(defense ? row.opponent_team : row.team || "")).filter(Boolean)));
  const base = new Map<string, ReturnType<typeof aggregate>>();
  for (const team of teams) {
    const teamRows = filtered.filter(row => String(defense ? row.opponent_team : row.team) === team);
    base.set(team, aggregate(teamRows));
  }
  const rankFor = (key: keyof ReturnType<typeof aggregate>, lowerBetter = false) =>
    rankMap(Array.from(base.entries()).map(([team, value]) => [team, typeof value[key] === "number" ? value[key] as number : null]), lowerBetter);
  const ranks = {
    epaPerPlay: rankFor("epaPerPlay", defense),
    passEpaPerDropback: rankFor("passEpaPerDropback", defense),
    rushEpaPerCarry: rankFor("rushEpaPerCarry", defense),
    yardsPerPlay: rankFor("yardsPerPlay", defense),
    explosiveRate: rankFor("explosiveRate", defense),
    firstDownRate: rankFor("firstDownRate", defense),
    turnoverRate: rankFor("turnoverRate", !defense),
    sackRate: rankFor("sackRate", !defense),
    cpoe: rankFor("cpoe", defense)
  };
  const out = new Map<string, Snapshot>();
  for (const [team, value] of base) {
    out.set(team, {
      ...value,
      epaPerPlayRank: ranks.epaPerPlay.get(team) || null,
      passEpaPerDropbackRank: ranks.passEpaPerDropback.get(team) || null,
      rushEpaPerCarryRank: ranks.rushEpaPerCarry.get(team) || null,
      yardsPerPlayRank: ranks.yardsPerPlay.get(team) || null,
      explosiveRateRank: ranks.explosiveRate.get(team) || null,
      firstDownRateRank: ranks.firstDownRate.get(team) || null,
      turnoverRateRank: ranks.turnoverRate.get(team) || null,
      sackRateRank: ranks.sackRate.get(team) || null,
      cpoeRank: ranks.cpoe.get(team) || null
    });
  }
  return out;
}

function localSameTeam(team: string, candidate: string) {
  const a = nflAbbr(team);
  const b = nflAbbr(candidate);
  return Boolean(a && b && a === b);
}

function dedupeLocalGames(games: LocalGame[]) {
  const unique = new Map<string, LocalGame>();
  for (const game of games) {
    const key = [
      game.commence_time,
      nflAbbr(game.away_team) || normalizeTeamNameKey(game.away_team),
      nflAbbr(game.home_team) || normalizeTeamNameKey(game.home_team)
    ].join(":");
    const existing = unique.get(key);
    if (!existing || (existing.final_home_score == null && game.final_home_score != null)) unique.set(key, game);
  }
  return Array.from(unique.values()).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

function localGamesFor(games: LocalGame[], team: string, cutoff: number) {
  return games.filter(game =>
    new Date(game.commence_time).getTime() < cutoff &&
    game.final_home_score != null && game.final_away_score != null &&
    (localSameTeam(team, game.home_team) || localSameTeam(team, game.away_team))
  ).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

function summarizeResults(games: LocalGame[], team: string) {
  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0;
  const recent = games.map(game => {
    const home = localSameTeam(team, game.home_team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    const margin = teamPoints - opponentPoints;
    if (margin > 0) wins += 1;
    else if (margin < 0) losses += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
    return {
      id: game.id,
      week: game.week,
      date: game.commence_time,
      opponent: home ? game.away_team : game.home_team,
      home,
      teamPoints,
      opponentPoints,
      margin,
      result: margin > 0 ? "W" as const : margin < 0 ? "L" as const : "T" as const
    };
  });
  return {
    record: { wins, losses },
    scoring: {
      ppg: games.length ? pointsFor / games.length : null,
      allowedPpg: games.length ? pointsAgainst / games.length : null,
      margin: games.length ? (pointsFor - pointsAgainst) / games.length : null
    },
    recent: recent.slice().reverse()
  };
}

function localSpreadFor(game: LocalGame, team: string) {
  if (!game.current_spread_team || game.current_spread == null) return null;
  const spread = Number(game.current_spread);
  if (!Number.isFinite(spread)) return null;
  return localSameTeam(team, game.current_spread_team) ? spread : -spread;
}

function summarizeAts(games: LocalGame[], team: string) {
  const graded = games.flatMap(game => {
    const spread = localSpreadFor(game, team);
    if (spread == null) return [];
    const home = localSameTeam(team, game.home_team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    const coverMargin = teamPoints - opponentPoints + spread;
    return [{
      id: game.id,
      week: game.week,
      date: game.commence_time,
      opponent: home ? game.away_team : game.home_team,
      home,
      spread,
      teamPoints,
      opponentPoints,
      coverMargin,
      result: Math.abs(coverMargin) < 0.001 ? "P" as const : coverMargin > 0 ? "W" as const : "L" as const
    }];
  });
  return {
    wins: graded.filter(row => row.result === "W").length,
    losses: graded.filter(row => row.result === "L").length,
    pushes: graded.filter(row => row.result === "P").length,
    avgCoverMargin: graded.length ? graded.reduce((sum, row) => sum + row.coverMargin, 0) / graded.length : null,
    recent: graded.slice().reverse()
  };
}

async function buildMatchup(game: NflMatchupGame) {
  const season = seasonFor(game);
  const throughWeek = Math.max(0, game.week - 1);
  const cutoff = new Date(game.commence_time).getTime();
  const awayAbbr = nflAbbr(game.away_team);
  const homeAbbr = nflAbbr(game.home_team);
  const [stats, local] = await Promise.all([
    fetchTeamStats(season).catch(() => [] as SportsDataRow[]),
    getSupabaseAdmin().from("games")
      .select("id,week,commence_time,home_team,away_team,current_spread_team,current_spread,final_home_score,final_away_score")
      .eq("league", "NFL")
      .gte("commence_time", `${season}-08-01T00:00:00Z`)
      .lt("commence_time", game.commence_time)
      .order("commence_time", { ascending: true })
      .limit(200)
      .abortSignal(AbortSignal.timeout(8_000))
  ]);
  const localGames = dedupeLocalGames((local.data || []) as LocalGame[]);
  const availableWeeks = stats
    .filter(row => String(row.season_type || "").toUpperCase() === "REG")
    .map(row => finiteNumber(row.week))
    .filter((week): week is number => week != null && week <= throughWeek);
  const dataThroughWeek = availableWeeks.length ? Math.max(...availableWeeks) : 0;
  const offense = snapshots(stats, dataThroughWeek, false);
  const defense = snapshots(stats, dataThroughWeek, true);

  const makeTeam = (name: string, abbr: string) => {
    const games = localGamesFor(localGames, name, cutoff);
    const result = summarizeResults(games, name);
    return {
      name: teamDisplayName("NFL", name),
      abbreviation: abbr,
      record: result.record,
      scoring: result.scoring,
      recent: result.recent,
      ats: { ...summarizeAts(games, name), available: !local.error },
      offense: offense.get(abbr) || null,
      defense: defense.get(abbr) || null,
      advancedAvailable: Boolean(offense.get(abbr) && defense.get(abbr)),
      resultsAvailable: games.length > 0
    };
  };

  const away = makeTeam(game.away_team, awayAbbr);
  const home = makeTeam(game.home_team, homeAbbr);
  const allTeams = Array.from(new Set([...offense.keys(), ...defense.keys()]));
  const overallValues = allTeams.map(team => {
    const off = offense.get(team)?.epaPerPlay;
    const def = defense.get(team)?.epaPerPlay;
    return [team, off != null && def != null ? off - def : null] as [string, number | null];
  });
  const overallRanks = rankMap(overallValues);
  const overall = (abbr: string) => {
    const off = offense.get(abbr)?.epaPerPlay;
    const def = defense.get(abbr)?.epaPerPlay;
    return {
      value: off != null && def != null ? off - def : null,
      rank: overallRanks.get(abbr) || null
    };
  };

  return {
    season,
    throughWeek: dataThroughWeek,
    fetchedAt: new Date().toISOString(),
    source: "nflverse-team-stats",
    teams: {
      away: { ...away, overall: overall(awayAbbr) },
      home: { ...home, overall: overall(homeAbbr) }
    }
  };
}

async function espnSchedule(team: string, season: number) {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${encodeURIComponent(team)}/schedule?season=${season}`,
    { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(8_000) }
  );
  if (!response.ok) throw new Error("NFL history unavailable");
  const payload = await response.json();
  return Array.isArray(payload?.events) ? payload.events : [];
}

async function buildHistory(game: NflMatchupGame) {
  const season = seasonFor(game);
  const awayAbbr = nflAbbr(game.away_team);
  const homeAbbr = nflAbbr(game.home_team);
  if (!awayAbbr || !homeAbbr) return { games: [], seasons: 8, complete: false };
  const snapshots = await Promise.all(Array.from({ length: 8 }, (_, index) =>
    espnSchedule(awayAbbr.toLowerCase(), season - index)
      .then(events => ({ events, ok: true }))
      .catch(() => ({ events: [] as any[], ok: false }))
  ));
  const games = snapshots.flatMap(({ events }) => events).flatMap((event: any) => {
    const competition = event?.competitions?.[0];
    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
    const away = competitors.find((row: any) => row.homeAway === "away");
    const home = competitors.find((row: any) => row.homeAway === "home");
    const date = competition?.date || event?.date;
    if (!away || !home || !date || new Date(date).getTime() >= new Date(game.commence_time).getTime()) return [];
    const awayCode = String(away?.team?.abbreviation || "");
    const homeCode = String(home?.team?.abbreviation || "");
    if (![awayCode, homeCode].includes(homeAbbr) || ![awayCode, homeCode].includes(awayAbbr)) return [];
    const awayScore = finiteNumber(away?.score?.value ?? away?.score);
    const homeScore = finiteNumber(home?.score?.value ?? home?.score);
    if (awayScore == null || homeScore == null || !competition?.status?.type?.completed) return [];
    const awayIsTarget = awayCode === awayAbbr;
    return [{
      id: String(event?.id || date),
      season: new Date(date).getUTCFullYear(),
      date,
      teamPoints: awayIsTarget ? awayScore : homeScore,
      opponentPoints: awayIsTarget ? homeScore : awayScore,
      venue: competition?.venue?.fullName || null,
      neutralSite: Boolean(competition?.neutralSite)
    }];
  }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return { games, seasons: 8, complete: snapshots.every(row => row.ok) };
}

export function loadNflMatchup(game: NflMatchupGame) {
  return previewCache(`${game.id}:${game.week}:${game.commence_time}`, () => buildMatchup(game));
}

export function loadNflMatchupHistory(game: NflMatchupGame) {
  return historyCache(`${game.id}:${game.commence_time}`, () => buildHistory(game));
}
