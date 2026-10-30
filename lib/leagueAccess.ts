import { APP_USERS, findFamilyUser, type PickemAppSlug } from "./authUsers.ts";
import { APP_IDENTITY_CONFIG, isPickemAppSlug } from "./appIdentity.ts";

export type LeagueMembership = {
  slug: PickemAppSlug;
  name: string;
  homePath: string;
  sport: "Football" | "Basketball";
  role: "owner" | "admin" | "member";
};

const LEAGUE_ORDER: PickemAppSlug[] = ["shaw-family", "other-family", "friends", "friends-basketball"];

const LEAGUE_NAMES: Record<PickemAppSlug, string> = {
  "shaw-family": "Shaw Family Football",
  friends: "Just Cover Football",
  "friends-basketball": "Just Cover Basketball",
  "other-family": "Caleb’s Family Football"
};

export function leagueNameForSlug(slug: PickemAppSlug): string {
  return LEAGUE_NAMES[slug];
}

/** The first league assigned to the account is its default launch destination. */
export function defaultLeagueForLaunch(leagues: LeagueMembership[]): LeagueMembership | null {
  return leagues[0] || null;
}

export function isKnownPickemUser(username: string) {
  const normalized = username.trim().toLowerCase();
  return Object.values(APP_USERS).some((roster) => roster.some((user) => user.username === normalized));
}

/** The roster is an extra allowlist; database membership remains the source of truth. */
export function accessibleLeaguesForUser(
  username: string,
  groups: Array<{ slug: string; role: "owner" | "admin" | "member" }>
): LeagueMembership[] {
  const allowed = new Map(groups
    .filter((group) => isPickemAppSlug(group.slug) && Boolean(findFamilyUser(username, group.slug)))
    .map((group) => [group.slug as PickemAppSlug, group.role]));

  return LEAGUE_ORDER.filter((slug) => allowed.has(slug)).map((slug) => ({
    slug,
    name: LEAGUE_NAMES[slug],
    homePath: APP_IDENTITY_CONFIG[slug].homePath,
    sport: slug === "friends-basketball" ? "Basketball" : "Football",
    role: allowed.get(slug)!
  }));
}
