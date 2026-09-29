import { normalizeTeamNameKey, teamDisplayName } from "./teamNames";

export const CFB_MODEL_HOME_FIELD_POINTS = 2.5;

export type CfbModelGame = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  current_spread_team: string | null;
  current_spread: number | null;
};

export type CfbRatingPair = {
  id: string;
  label: string;
  homeRating: number | null;
  awayRating: number | null;
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
  "texas san antonio": "utsa"
};

export function cfbModelTeamKey(value: string) {
  const displayed = teamDisplayName("CFB", value);
  const key = normalizeTeamNameKey(displayed)
    .replace(/\bflorida\b(?=\s*$)/, "fl")
    .replace(/\bohio\b(?=\s*$)/, "oh");
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

export function modelHomeSpread(homeRating: number, awayRating: number, homeFieldPoints = CFB_MODEL_HOME_FIELD_POINTS) {
  const expectedHomeMargin = homeRating - awayRating + homeFieldPoints;
  return Math.round(-expectedHomeMargin * 10) / 10;
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

export function buildCfbModelProjection(game: CfbModelGame, ratings: CfbRatingPair[], fetchedAt = new Date().toISOString()): CfbModelProjection {
  const models = ratings.flatMap((rating) => {
    if (rating.homeRating == null || rating.awayRating == null ||
        !Number.isFinite(rating.homeRating) || !Number.isFinite(rating.awayRating)) return [];
    const projection = favoriteSpread(game, modelHomeSpread(rating.homeRating, rating.awayRating));
    return [{ id: rating.id, label: rating.label, ...projection }];
  });

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

  return {
    gameId: game.id,
    fetchedAt,
    market,
    models,
    consensus,
    edgePoints,
    edgeTeam,
    stars: modelEdgeStars(edgePoints)
  };
}
