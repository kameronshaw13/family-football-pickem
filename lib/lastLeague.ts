import { isPickemAppSlug } from "./appIdentity";
import type { PickemAppSlug } from "./authUsers";

function storageKey(profileId: string) {
  return `pickem_last_league:${profileId}`;
}

/** Each profile remembers its own last visited league on this device. */
export function rememberLastLeague(profileId: string, slug: PickemAppSlug) {
  if (typeof window === "undefined" || !profileId) return;
  try {
    window.localStorage.setItem(storageKey(profileId), slug);
  } catch {
    // In private mode the league home still works as usual.
  }
}

export function lastVisitedLeague(profileId: string): PickemAppSlug | null {
  if (typeof window === "undefined" || !profileId) return null;
  try {
    const slug = window.localStorage.getItem(storageKey(profileId));
    return isPickemAppSlug(slug) ? slug : null;
  } catch {
    return null;
  }
}
