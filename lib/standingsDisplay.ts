import type { Pick, Profile, Standing } from "./types.ts";

/** Stable card signatures and complete season table ordering. */
export function pickCardSignature(card: Pick[]) {
  return card
    .map((pick) => `${pick.game_id}:${pick.selected_team}:${pick.pick_type}`)
    .sort()
    .join("|");
}

export function completeSeasonStandings(profiles: Profile[], rows: Standing[]) {
  const byUser = new Map(rows.map((row) => [row.user_id, row]));
  const complete = profiles.map((profile) => byUser.get(profile.id) || {
    user_id: profile.id,
    display_name: profile.display_name,
    wins: 0,
    losses: 0,
    pushes: 0,
    win_pct: 0
  });

  return complete.sort((a, b) =>
    (Number(b.win_pct) - Number(a.win_pct)) ||
    (Number(b.wins) - Number(a.wins)) ||
    (Number(a.losses) - Number(b.losses)) ||
    a.display_name.localeCompare(b.display_name)
  );
}

