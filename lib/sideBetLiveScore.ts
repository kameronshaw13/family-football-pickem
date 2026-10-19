import { fetchEspnEvent, fetchEspnSchedule } from "./espnSchedule.ts";

/** Live offers expire on confirmed score changes, never market price movement. */
export type LiveScoreSnapshot = { home: number; away: number; completed: boolean };

export function scoreNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) ? score : null;
}

export function storedLiveScore(game: any): LiveScoreSnapshot | null {
  const home = scoreNumber(game?.live_home_score);
  const away = scoreNumber(game?.live_away_score);
  if (home == null || away == null) return null;
  return {
    home,
    away,
    completed: Boolean(game?.live_completed || (game?.final_home_score != null && game?.final_away_score != null))
  };
}

export async function currentLiveScore(game: any, freshness: boolean | number = true): Promise<LiveScoreSnapshot | null> {
  if (game?.espn_event_id && (game?.league === "CFB" || game?.league === "NFL")) {
    try {
      const event = await fetchEspnEvent(game.league, game.espn_event_id, freshness);
      if (event?.homeScore != null && event?.awayScore != null) {
        return { home: Number(event.homeScore), away: Number(event.awayScore), completed: Boolean(event.completed) };
      }
    } catch {
      // Keep the offer alive when the live-score provider has a brief interruption.
    }
  }
  return storedLiveScore(game);
}

export async function scoreboardLiveScore(game: any, freshness: boolean | number = true): Promise<LiveScoreSnapshot | null> {
  if (!game?.espn_event_id || (game?.league !== "CFB" && game?.league !== "NFL")) return null;
  try {
    const schedule = await fetchEspnSchedule(game.league, [game.commence_time], freshness, 0);
    const event = schedule.find((candidate) => String(candidate.id) === String(game.espn_event_id));
    if (event?.homeScore == null || event?.awayScore == null) return null;
    return {
      home: Number(event.homeScore),
      away: Number(event.awayScore),
      completed: Boolean(event.completed)
    };
  } catch {
    return null;
  }
}

export function liveScoreSnapshotStable(summaryScore: LiveScoreSnapshot | null, scoreboardScore: LiveScoreSnapshot | null) {
  return Boolean(
    summaryScore &&
    scoreboardScore &&
    summaryScore.home === scoreboardScore.home &&
    summaryScore.away === scoreboardScore.away
  );
}

export function liveScoreDiffersFromOffer(bet: any, score: LiveScoreSnapshot | null) {
  if (!score) return false;
  const sentHome = scoreNumber(bet?.live_offer_home_score);
  const sentAway = scoreNumber(bet?.live_offer_away_score);
  if (sentHome == null || sentAway == null) return false;
  return score.home !== sentHome || score.away !== sentAway;
}

export function liveScoreMatches(score: LiveScoreSnapshot | null, home: number, away: number) {
  return Boolean(score && score.home === home && score.away === away);
}

export function liveScoreConfirmedByEither(
  summaryScore: LiveScoreSnapshot | null,
  scoreboardScore: LiveScoreSnapshot | null,
  home: number,
  away: number
) {
  return liveScoreMatches(summaryScore, home, away) || liveScoreMatches(scoreboardScore, home, away);
}

export function liveScoreConsensus(
  summaryScore: LiveScoreSnapshot | null,
  scoreboardScore: LiveScoreSnapshot | null
): LiveScoreSnapshot | null {
  if (!summaryScore || !scoreboardScore) return null;
  return summaryScore.home === scoreboardScore.home && summaryScore.away === scoreboardScore.away
    ? summaryScore
    : null;
}

