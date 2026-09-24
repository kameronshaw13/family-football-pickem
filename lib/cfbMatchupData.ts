import { normalizeTeamNameKey, teamDisplayName } from "./teamNames.ts";

export type LocalGame = {
  id: string;
  week: number;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
  current_spread_team: string | null;
  current_spread: number | null;
  final_home_score: number | null;
  final_away_score: number | null;
};

export function sameTeam(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const aSchool = teamDisplayName("CFB", a);
  const bSchool = teamDisplayName("CFB", b);
  return normalizeTeamNameKey(aSchool) === normalizeTeamNameKey(bSchool);
}

export function finiteNumber(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function logoTeamId(url: string | null | undefined) {
  if (!url) return null;
  return url.match(/\/(\d+)\.(?:png|svg|webp)(?:\?|$)/i)?.[1] || null;
}

export type SportsDataRow = Record<string, string>;

export function parseCsv(text: string, keep?: (header: string) => boolean): SportsDataRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  const headers = rows.shift()?.map((value) => value.trim()) || [];
  if (!headers.length) return [];
  return rows.map((values) => Object.fromEntries(headers.flatMap((header, index) => !keep || keep(header) ? [[header, values[index] ?? ""]] : [])));
}

export function rowNumber(row: SportsDataRow | null, key: string) {
  return row ? finiteNumber(row[key]) : null;
}

export function latestWeeklyRow(
  rows: SportsDataRow[],
  teamId: string | null,
  weekKey: string,
  maxWeek: number,
  extraFilter?: (row: SportsDataRow) => boolean
) {
  if (!teamId) return null;
  return rows
    .filter((row) => String(row.team_id || "").replace(/\.0$/, "") === String(teamId) &&
      (finiteNumber(row[weekKey]) ?? -1) <= maxWeek &&
      (!extraFilter || extraFilter(row)))
    .sort((a, b) => (finiteNumber(b[weekKey]) ?? -1) - (finiteNumber(a[weekKey]) ?? -1))[0] || null;
}

export function exactWeeklySummaryRow(rows: SportsDataRow[], teamId: string | null, team: string, throughWeek: number) {
  if (throughWeek < 0) return null;
  return rows.find((row) => {
    if (finiteNumber(row.through_week) !== throughWeek) return false;
    const rowId = String(row.team_id || "").replace(/\.0$/, "");
    if (teamId && rowId === String(teamId)) return true;
    return sameTeam(row.pos_team || row.team, team);
  }) || null;
}

export function normalizeRelative(summaryRow: SportsDataRow | null) {
  if (!summaryRow) return null;
  const validGames = rowNumber(summaryRow, "valid_games");
  const value = (key: string) => rowNumber(summaryRow, key);
  const rank = (key: string) => rowNumber(summaryRow, key);
  return {
    source: "sportsdataverse-team-summaries-weekly",
    throughWeek: rowNumber(summaryRow, "through_week"),
    validGames,
    limitedSample: validGames != null && validGames < 3,
    overallValue: value("net_adj_epa"),
    overallRank: rank("net_adj_epa_rank"),
    offense: {
      adjustedEpa: value("adj_off_epa"),
      adjustedEpaRank: rank("adj_off_epa_rank"),
      epaPerDrive: value("EPAdrive_off"),
      epaPerDriveRank: rank("EPAdrive_off_rank"),
      availableYardsRate: value("available_yards_pct_off"),
      availableYardsRateRank: rank("available_yards_pct_off_rank"),
      earlyDownEpa: value("early_down_EPA_off"),
      earlyDownEpaRank: rank("early_down_EPA_off_rank"),
      lateDownRate: value("late_down_success_off"),
      lateDownRank: rank("late_down_success_off_rank"),
      epaPerPlay: value("EPAplay_off"),
      epaPerPlayRank: rank("EPAplay_off_rank"),
      successRate: value("success_off"),
      successRateRank: rank("success_off_rank"),
      explosivePlayRate: value("explosive_off"),
      explosivePlayRank: rank("explosive_off_rank"),
      yardsPerPlay: value("yardsplay_off"),
      yardsPerPlayRank: rank("yardsplay_off_rank"),
      lineYards: value("line_yards_off"),
      lineYardsRank: rank("line_yards_off_rank"),
      thirdDownRate: value("third_down_success_off"),
      thirdDownRank: rank("third_down_success_off_rank"),
      redZoneRate: value("red_zone_success_off"),
      redZoneRank: rank("red_zone_success_off_rank")
    },
    defense: {
      adjustedEpa: value("adj_def_epa"),
      adjustedEpaRank: rank("adj_def_epa_rank"),
      epaPerDrive: value("EPAdrive_def"),
      epaPerDriveRank: rank("EPAdrive_def_rank"),
      availableYardsRate: value("available_yards_pct_def"),
      availableYardsRateRank: rank("available_yards_pct_def_rank"),
      earlyDownEpa: value("early_down_EPA_def"),
      earlyDownEpaRank: rank("early_down_EPA_def_rank"),
      lateDownRate: value("late_down_success_def"),
      lateDownRank: rank("late_down_success_def_rank"),
      epaPerPlay: value("EPAplay_def"),
      epaPerPlayRank: rank("EPAplay_def_rank"),
      successRate: value("success_def"),
      successRateRank: rank("success_def_rank"),
      explosivePlayRate: value("explosive_def"),
      explosivePlayRank: rank("explosive_def_rank"),
      yardsPerPlay: value("yardsplay_def"),
      yardsPerPlayRank: rank("yardsplay_def_rank"),
      lineYards: value("line_yards_def"),
      lineYardsRank: rank("line_yards_def_rank"),
      thirdDownRate: value("third_down_success_def"),
      thirdDownRank: rank("third_down_success_def_rank"),
      redZoneRate: value("red_zone_success_def"),
      redZoneRank: rank("red_zone_success_def_rank")
    }
  };
}

export function falseyCsv(value: string | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "" || normalized === "false" || normalized === "0" || normalized === "no";
}

export function normalizePower(summaryRow: SportsDataRow | null, fpiRow: SportsDataRow | null) {
  if (!summaryRow && !fpiRow) return null;
  return {
    source: "sportsdataverse-team-summaries",
    throughWeek: rowNumber(fpiRow, "week"),
    fpi: rowNumber(fpiRow, "fpi"),
    fpiRank: rowNumber(fpiRow, "rank"),
    offenseEfficiency: rowNumber(fpiRow, "offefficiency"),
    offenseEfficiencyRank: rowNumber(fpiRow, "offefficiencyrank"),
    defenseEfficiency: rowNumber(fpiRow, "defefficiency"),
    defenseEfficiencyRank: rowNumber(fpiRow, "defefficiencyrank"),
    specialTeamsEfficiency: rowNumber(fpiRow, "stefficiency"),
    specialTeamsEfficiencyRank: rowNumber(fpiRow, "stefficiencyrank"),
    adjustedOffEpa: rowNumber(summaryRow, "adj_off_epa"),
    adjustedDefEpa: rowNumber(summaryRow, "adj_def_epa"),
    adjustedNetEpa: rowNumber(summaryRow, "net_adj_epa"),
    adjustedOffRank: rowNumber(summaryRow, "adj_off_epa_rank"),
    adjustedDefRank: rowNumber(summaryRow, "adj_def_epa_rank"),
    adjustedNetRank: rowNumber(summaryRow, "net_adj_epa_rank")
  };
}

export function localGamesForTeam(games: LocalGame[], team: string, targetDate: number, season: number) {
  return games
    .filter((game) => {
      const kickoff = new Date(game.commence_time);
      return (kickoff.getUTCMonth() < 2 ? kickoff.getUTCFullYear() - 1 : kickoff.getUTCFullYear()) === season &&
        kickoff.getTime() < targetDate &&
        game.final_home_score != null &&
        game.final_away_score != null &&
        (sameTeam(game.home_team, team) || sameTeam(game.away_team, team));
    })
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

export function summarizeLocalGames(games: LocalGame[], team: string) {
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;

  for (const game of games) {
    const home = sameTeam(game.home_team, team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    if (teamPoints > opponentPoints) wins += 1;
    else if (teamPoints < opponentPoints) losses += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
  }

  const recent = [...games].reverse().map((game) => {
    const home = sameTeam(game.home_team, team);
    const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
    const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
    const opponent = home ? game.away_team : game.home_team;
    const margin = teamPoints - opponentPoints;
    return {
      id: game.id,
      week: game.week,
      date: game.commence_time,
      opponent,
      home,
      teamPoints,
      opponentPoints,
      margin,
      result: margin > 0 ? "W" : margin < 0 ? "L" : "T"
    };
  });

  return {
    record: { wins, losses },
    scoring: {
      ppg: games.length ? pointsFor / games.length : null,
      allowedPpg: games.length ? pointsAgainst / games.length : null,
      margin: games.length ? (pointsFor - pointsAgainst) / games.length : null
    },
    recent
  };
}

export function spreadForLocalTeam(game: LocalGame, team: string) {
  if (game.current_spread == null || !game.current_spread_team) return null;
  const spread = Number(game.current_spread);
  if (!Number.isFinite(spread)) return null;
  return sameTeam(game.current_spread_team, team) ? spread : -spread;
}

export function summarizeLocalAts(games: LocalGame[], team: string, targetDate: number, season: number) {
  const graded = localGamesForTeam(games, team, targetDate, season)
    .map((game) => {
      const spread = spreadForLocalTeam(game, team);
      if (spread == null) return null;
      const home = sameTeam(game.home_team, team);
      const teamPoints = Number(home ? game.final_home_score : game.final_away_score);
      const opponentPoints = Number(home ? game.final_away_score : game.final_home_score);
      const opponent = home ? game.away_team : game.home_team;
      const coverMargin = teamPoints - opponentPoints + spread;
      return {
        id: game.id,
        week: game.week,
        date: game.commence_time,
        opponent,
        home,
        spread,
        teamPoints,
        opponentPoints,
        coverMargin,
        result: Math.abs(coverMargin) < 0.001 ? "P" : coverMargin > 0 ? "W" : "L"
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      week: number;
      date: string;
      opponent: string;
      home: boolean;
      spread: number;
      teamPoints: number;
      opponentPoints: number;
      coverMargin: number;
      result: "W" | "L" | "P";
    }>;

  const wins = graded.filter((game) => game.result === "W").length;
  const losses = graded.filter((game) => game.result === "L").length;
  const pushes = graded.filter((game) => game.result === "P").length;

  return {
    wins,
    losses,
    pushes,
    avgCoverMargin: graded.length ? graded.reduce((sum, game) => sum + game.coverMargin, 0) / graded.length : null,
    recent: graded.slice().reverse()
  };
}

export function scheduleEvent(event: any, teamId: string) {
  const competition = event?.competitions?.[0];
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const own = competitors.find((row: any) => String(row?.team?.id) === String(teamId));
  const opponent = competitors.find((row: any) => String(row?.team?.id) !== String(teamId));
  if (!own || !opponent) return null;
  const teamPoints = finiteNumber(own?.score?.value ?? own?.score);
  const opponentPoints = finiteNumber(opponent?.score?.value ?? opponent?.score);
  const completed = Boolean(competition?.status?.type?.completed || event?.status?.type?.completed);
  const date = competition?.date || event?.date;
  if (!date) return null;
  return {
    id: String(event?.id || competition?.id || date),
    date,
    week: Number(event?.week?.number || competition?.week?.number || 0),
    home: own?.homeAway === "home",
    neutralSite: Boolean(competition?.neutralSite),
    venue: competition?.venue?.fullName || null,
    ownName: own?.team?.displayName || own?.team?.shortDisplayName || "",
    opponentName: opponent?.team?.displayName || opponent?.team?.shortDisplayName || "",
    opponentId: String(opponent?.team?.id || ""),
    teamPoints,
    opponentPoints,
    completed
  };
}

export function summarizeEspnSchedule(schedule: Array<NonNullable<ReturnType<typeof scheduleEvent>>>, targetDate: number) {
  const completed = schedule
    .filter((game) => game.completed && game.teamPoints != null && game.opponentPoints != null && new Date(game.date).getTime() < targetDate)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  for (const game of completed) {
    const teamPoints = Number(game.teamPoints);
    const opponentPoints = Number(game.opponentPoints);
    if (teamPoints > opponentPoints) wins += 1;
    else if (teamPoints < opponentPoints) losses += 1;
    pointsFor += teamPoints;
    pointsAgainst += opponentPoints;
  }
  return {
    games: completed.length,
    record: { wins, losses },
    scoring: {
      ppg: completed.length ? pointsFor / completed.length : null,
      allowedPpg: completed.length ? pointsAgainst / completed.length : null,
      margin: completed.length ? (pointsFor - pointsAgainst) / completed.length : null
    },
    recent: recentFromEspnSchedule(completed, targetDate)
  };
}

export function recentFromEspnSchedule(schedule: Array<NonNullable<ReturnType<typeof scheduleEvent>>>, targetDate: number) {
  return schedule
    .filter((game) => game.completed && game.teamPoints != null && game.opponentPoints != null && new Date(game.date).getTime() < targetDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((game) => {
      const margin = Number(game.teamPoints) - Number(game.opponentPoints);
      return {
        id: game.id,
        week: game.week,
        date: game.date,
        opponent: game.opponentName,
        home: game.home,
        teamPoints: Number(game.teamPoints),
        opponentPoints: Number(game.opponentPoints),
        margin,
        result: margin > 0 ? "W" : margin < 0 ? "L" : "T"
      };
    });
}
