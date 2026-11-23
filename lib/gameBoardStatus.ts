import type { Game } from "@/lib/types";

/** Canonical game-day and result-state checks, shared by board presentation
 * and app components without requiring React/TSX during data-only tests. */
export const CENTRAL_DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Chicago"
});

export function gameDayKey(iso: string) {
  return CENTRAL_DAY_KEY_FORMATTER.format(new Date(iso));
}

export function isPostponedGame(game: Game) {
  return ["STATUS_POSTPONED", "STATUS_CANCELED", "STATUS_CANCELLED", "STATUS_RESCHEDULED"].includes(game.event_status || "");
}

export function isFinalGame(game: Game) {
  return !isPostponedGame(game) && ((game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed));
}
