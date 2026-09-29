import { normalizeTeamNameKey, teamDisplayName } from "./teamNames";

export const CFB_MODEL_HOME_FIELD_POINTS = 2.5;
const ELO_POINTS_PER_SPREAD_POINT = 25;
const CORE_PLAYS_PER_TEAM = 68;
const EPA_PLAYS_PER_TEAM = 65;

export type CfbModelGame = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
  current_spread_team: string | null;
  current_spread: number | null;
};

export type CfbCompletedGame = {
  commence_time: string;
  home_team: string;
  away_team: string;
  final_home_score: number | null;
  final_away_score: number | null;
};

export type CfbRatingPair = {
  id: string;
  label: string;
  homeRating: number | null;
  awayRating: number | null;
};

export type CfbDirectProjection = {
  id: string;
  label: string;
  homeSpread: number | null;
};

export type CfbModelProjectionRow = {
  id: string;
  label: string;
  team: string | null;
  spread: number;
  homeSpread: number;
};

export type CfbModelProjection = {
  gameId: string;
  fetchedAt: string;
  market: { team: string | null; spread: number | null; homeSpread: number | null };
  models: CfbModelProjectionRow[];
  consensus: { team: string | null; spread: number; homeSpread: number } | null;
  edgePoints: number | null;
  edgeTeam: string | null;
  stars: number;
};

const TEAM_ALIASES: Record<string, string> = {
  "app state": "appalachian state",
  "connecticut": "uconn",
  "florida international": "fiu",
  "massachusetts": "umass",
  "miami fl": "miami",
  "miami florida": "miami",
  "miami oh": "miami ohio",
  "sam houston state": "sam houston",
  "texas el paso": "utep",
  "texas san antonio": "utsa",
  "ul monroe": "louisiana monroe"
};

export function cfbModelTeamKey(value: string) {
  const key = normalizeTeamNameKey(teamDisplayName("CFB", value));
  return TEAM_ALIASES[key] || key;
}

export function cfbSeasonForDate(dateIso: string) {
  const date = new Date(dateIso);
  return date.getUTCMonth() < 2 ? date.getUTCFullYear() - 1 : date.getUTCFullYear();
}

function sameTeam(a: string | null | undefined, b: string) {
  return Boolean(a) && cfbModelTeamKey(String(a)) === cfbModelTeamKey(b);
}

export function marketHomeSpread(game: CfbModelGame) {
  if (!game.current_spread_team || game.current_spread == null || !Number.isFinite(Number(game.current_spread))) return null;
  const spread = Number(game.current_spread);
  if (sameTeam(game.current_spread_team, game.home_team)) return spread;
  if (sameTeam(game.current_spread_team, game.away_team)) return -spread;
  return null;
}

export function pointRatingFromElo(elo: number) {
  return (elo - 1500) / ELO_POINTS_PER_SPREAD_POINT;
}

export function pointRatingFromCore(overall: number) {
  return overall * (CORE_PLAYS_PER_TEAM / 100);
}

export function pointRatingFromAdjustedEpa(netAdjustedEpa: number) {
  return netAdjustedEpa * EPA_PLAYS_PER_TEAM;
}

export function modelHomeSpread(homeRating: number, awayRating: number, homeFieldPoints = CFB_MODEL_HOME_FIELD_POINTS) {
  return Math.round(-(homeRating - awayRating + homeFieldPoints) * 10) / 10;
}

export function favoriteSpread(game: CfbModelGame, homeSpread: number) {
  const rounded = Math.round(homeSpread * 10) / 10;
  if (Math.abs(rounded) < 0.05) return { team: null, spread: 0, homeSpread: 0 };
  return rounded < 0
    ? { team: teamDisplayName("CFB", game.home_team), spread: rounded, homeSpread: rounded }
    : { team: teamDisplayName("CFB", game.away_team), spread: -rounded, homeSpread: rounded };
}

export function modelEdgeStars(edgePoints: number | null) {
  if (edgePoints == null || !Number.isFinite(edgePoints)) return 0;
  if (edgePoints >= 7) return 3;
  if (edgePoints >= 5) return 2;
  if (edgePoints >= 3) return 1;
  return 0;
}

function validCompletedGames(games: CfbCompletedGame[], cutoffIso: string) {
  const cutoff = new Date(cutoffIso).getTime();
  const unique = new Map<string, CfbCompletedGame>();
  for (const game of games) {
    if (game.final_home_score == null || game.final_away_score == null) continue;
    const kickoff = new Date(game.commence_time).getTime();
    if (!Number.isFinite(kickoff) || kickoff >= cutoff) continue;
    const key = `${game.commence_time}:${cfbModelTeamKey(game.away_team)}:${cfbModelTeamKey(game.home_team)}`;
    if (!unique.has(key)) unique.set(key, game);
  }
  return Array.from(unique.values()).sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}

export function buildResultsSrsRatings(games: CfbCompletedGame[], cutoffIso: string) {
  const rows = validCompletedGames(games, cutoffIso);
  const teams = new Set(rows.flatMap(game => [cfbModelTeamKey(game.home_team), cfbModelTeamKey(game.away_team)]));
  let ratings = new Map(Array.from(teams, team => [team, 0]));
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const next = new Map<string, number>();
    for (const team of teams) {
      const performances: number[] = [];
      for (const game of rows) {
        const home = cfbModelTeamKey(game.home_team);
        const away = cfbModelTeamKey(game.away_team);
        if (team !== home && team !== away) continue;
        const isHome = team === home;
        const teamScore = Number(isHome ? game.final_home_score : game.final_away_score);
        const oppScore = Number(isHome ? game.final_away_score : game.final_home_score);
        const opponent = isHome ? away : home;
        const venueAdjustment = isHome ? CFB_MODEL_HOME_FIELD_POINTS : -CFB_MODEL_HOME_FIELD_POINTS;
        performances.push(teamScore - oppScore - venueAdjustment + (ratings.get(opponent) || 0));
      }
      next.set(team, performances.length ? performances.reduce((sum, value) => sum + value, 0) / performances.length : 0);
    }
    const mean = next.size ? Array.from(next.values()).reduce((sum, value) => sum + value, 0) / next.size : 0;
    ratings = new Map(Array.from(next, ([team, value]) => [team, value - mean]));
  }
  return ratings;
}

export function buildResultsEloRatings(games: CfbCompletedGame[], cutoffIso: string) {
  const rows = validCompletedGames(games, cutoffIso);
  const ratings = new Map<string, number>();
  const get = (team: string) => ratings.get(team) ?? 1500;
  for (const game of rows) {
    const home = cfbModelTeamKey(game.home_team);
    const away = cfbModelTeamKey(game.away_team);
    const homeRating = get(home);
    const awayRating = get(away);
    const adjustedHome = homeRating + CFB_MODEL_HOME_FIELD_POINTS * ELO_POINTS_PER_SPREAD_POINT;
    const expectedHome = 1 / (1 + 10 ** ((awayRating - adjustedHome) / 400));
    const margin = Number(game.final_home_score) - Number(game.final_away_score);
    const actualHome = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
    const multiplier = Math.max(1, Math.min(2.25, Math.log(Math.abs(margin) + 1)));
    const change = 20 * multiplier * (actualHome - expectedHome);
    ratings.set(home, homeRating + change);
    ratings.set(away, awayRating - change);
  }
  return new Map(Array.from(ratings, ([team, elo]) => [team, pointRatingFromElo(elo)]));
}

export function buildCfbModelProjection(
  game: CfbModelGame,
  ratings: CfbRatingPair[],
  direct: CfbDirectProjection[] = [],
  fetchedAt = new Date().toISOString()
): CfbModelProjection {
  const ratingModels = ratings.flatMap((rating) => {
    if (rating.homeRating == null || rating.awayRating == null ||
        !Number.isFinite(rating.homeRating) || !Number.isFinite(rating.awayRating)) return [];
    const projection = favoriteSpread(game, modelHomeSpread(rating.homeRating, rating.awayRating));
    return [{ id: rating.id, label: rating.label, ...projection }];
  });
  const directModels = direct.flatMap((projection) => {
    if (projection.homeSpread == null || !Number.isFinite(projection.homeSpread)) return [];
    return [{ id: projection.id, label: projection.label, ...favoriteSpread(game, projection.homeSpread) }];
  });

  const models = [...ratingModels, ...directModels].filter((model, index, all) => all.findIndex(other => other.id === model.id) === index);
  const consensusHomeSpread = models.length >= 2
    ? Math.round((models.reduce((sum, model) => sum + model.homeSpread, 0) / models.length) * 10) / 10
    : null;
  const consensus = consensusHomeSpread == null ? null : favoriteSpread(game, consensusHomeSpread);
  const marketHome = marketHomeSpread(game);
  const edgePoints = consensus && marketHome != null
    ? Math.round(Math.abs(consensus.homeSpread - marketHome) * 10) / 10
    : null;
  const edgeTeam = consensus && marketHome != null && edgePoints != null && edgePoints > 0
    ? consensus.homeSpread < marketHome
      ? teamDisplayName("CFB", game.home_team)
      : teamDisplayName("CFB", game.away_team)
    : null;
  const market = marketHome == null
    ? { team: null, spread: null, homeSpread: null }
    : favoriteSpread(game, marketHome);

  return { gameId: game.id, fetchedAt, market, models, consensus, edgePoints, edgeTeam, stars: modelEdgeStars(edgePoints) };
}
