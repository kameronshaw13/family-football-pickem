import type { Game, Pick } from "./types.ts";

/**
 * Owns the client-side pick save transport and read-model reconciliation.
 * Server rules remain authoritative; this code never alters lock or grading.
 */
export function pickSaveRequest(token: string, group: string, week: number | null | undefined, picks: Pick[]) {
  return {
    url: "/api/picks",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-pickem-group": group },
      body: JSON.stringify({
        action: "saveCard", week,
        picks: picks.map(pick => ({
          gameId: pick.game_id,
          selectedTeam: pick.selected_team,
          pickType: pick.pick_type,
          confidencePoints: pick.confidence_points ?? null
        }))
      })
    }
  };
}

/** Attach the current week's canonical games to freshly returned picks. */
export function attachSavedPickGames(picks: Pick[], games: Game[]): Pick[] {
  return picks.map(pick => ({
    ...pick, game: games.find(game => game.id === pick.game_id) || pick.game
  }));
}

/** Replace only the signed-in player's current-week saved picks. */
export function reconcileSavedPicks<T extends {
  currentUser: { id: string };
  week: number;
  games: Game[];
  picks: Pick[];
}>(current: T, savedPicks: Pick[]): T {
  const nextSavedPicks = attachSavedPickGames(savedPicks, current.games);
  return {
    ...current,
    picks: [
      ...current.picks.filter(pick => !(pick.user_id === current.currentUser.id && pick.week === current.week)),
      ...nextSavedPicks
    ]
  };
}
