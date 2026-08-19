import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game, WeekRule } from "@/lib/types";
import { getGameLockTime, getSpreadFreezeTime } from "@/lib/lockRules";
import { getWeekRule } from "@/lib/weekRules";

export const DEFAULT_GROUP_SLUG = "shaw-family";
export const GROUP_COOKIE = "pickem_group";

export type PickemGroupSummary = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  currentSeasonYear: number;
  timezone: string;
  isDefault: boolean;
  branding: Record<string, unknown>;
  role: "owner" | "admin" | "member";
};

export type GroupContext = {
  group: PickemGroupSummary;
  seasonYear: number;
  seasonStatus: "setup" | "active" | "complete";
  rules: Record<string, any>;
  members: Array<{ id: string; username: string | null; display_name: string; is_admin: boolean }>;
};

function normalizeTeam(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function listActiveGroupsForProfile(supabase: SupabaseClient, profileId: string): Promise<PickemGroupSummary[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("role,status,group:pickem_groups(id,slug,name,short_name,current_season_year,timezone,is_default,is_active,branding)")
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (error) throw new Error(error.message);

  return (data || []).flatMap((membership: any) => {
    const group = relationOne<any>(membership.group);
    if (!group?.is_active) return [];
    return [{
      id: group.id,
      slug: group.slug,
      name: group.name,
      shortName: group.short_name || null,
      currentSeasonYear: Number(group.current_season_year),
      timezone: group.timezone || "America/Chicago",
      isDefault: Boolean(group.is_default),
      branding: group.branding || {},
      role: membership.role
    }];
  }).sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
}

export async function resolveGroupContext(supabase: SupabaseClient, profileId: string, requestedGroup?: string | null): Promise<GroupContext> {
  const groups = await listActiveGroupsForProfile(supabase, profileId);
  if (!groups.length) throw new Error("Your account is not assigned to an active Pick'em group.");
  const requested = requestedGroup?.trim();
  const group = requested ? groups.find((item) => item.id === requested || item.slug === requested) : groups.find((item) => item.isDefault) || groups[0];
  if (!group) throw new Error("That Pick'em group is not available to your account.");

  const [{ data: season, error: seasonError }, { data: memberships, error: memberError }] = await Promise.all([
    supabase.from("group_seasons").select("season_year,status,rules").eq("group_id", group.id).eq("season_year", group.currentSeasonYear).maybeSingle(),
    supabase.from("group_members").select("profile:profiles(id,username,display_name,is_admin)").eq("group_id", group.id).eq("status", "active")
  ]);
  if (seasonError) throw new Error(seasonError.message);
  if (memberError) throw new Error(memberError.message);
  if (!season) throw new Error(`${group.name} does not have an active season configuration.`);

  const members = (memberships || []).flatMap((row: any) => {
    const profile = relationOne<any>(row.profile);
    return profile ? [profile] : [];
  }).sort((a, b) => a.display_name.localeCompare(b.display_name));

  return { group, seasonYear: Number(season.season_year), seasonStatus: season.status, rules: season.rules || {}, members };
}

export function requestedGroupFromRequest(req: Request) {
  return req.headers.get("x-pickem-group") || cookieValue(req.headers.get("cookie"), GROUP_COOKIE) || null;
}

export function getGroupWeekRule(context: GroupContext, week: number): WeekRule {
  const fallback = getWeekRule(week);
  const pickRules = context.rules?.pickRules || {};
  const configured = pickRules.weekOverrides?.[String(week)] || pickRules.default || {};
  return {
    ...fallback,
    regularTotal: Number.isFinite(Number(configured.regularTotal)) ? Number(configured.regularTotal) : fallback.regularTotal,
    cfbMinimum: Number.isFinite(Number(configured.cfbMinimum)) ? Number(configured.cfbMinimum) : fallback.cfbMinimum,
    nflMinimum: Number.isFinite(Number(configured.nflMinimum)) ? Number(configured.nflMinimum) : fallback.nflMinimum,
    underdogTotal: Number.isFinite(Number(configured.underdogTotal)) ? Number(configured.underdogTotal) : fallback.underdogTotal,
    perfectBonus: typeof configured.perfectBonus === "boolean" ? configured.perfectBonus : fallback.perfectBonus
  };
}

export function isGameAllowedForGroup(context: GroupContext, game: Pick<Game, "league" | "home_team" | "away_team">) {
  const leagues = Array.isArray(context.rules?.eligibleLeagues) ? context.rules.eligibleLeagues.map(String) : ["CFB", "NFL"];
  if (!leagues.includes(game.league)) return false;
  const excluded = new Set((Array.isArray(context.rules?.excludedTeams) ? context.rules.excludedTeams : []).map(normalizeTeam));
  return !excluded.has(normalizeTeam(game.home_team)) && !excluded.has(normalizeTeam(game.away_team));
}

export function getGroupUnderdogBonus(context: GroupContext, spread: number | null | undefined) {
  const value = Number(spread);
  if (!Number.isFinite(value)) return 0;
  const dog = context.rules?.underdog || {};
  if (dog.enabled === false) return 0;
  const minimum = Number.isFinite(Number(dog.minimumSpread)) ? Number(dog.minimumSpread) : 7;
  if (value < minimum) return 0;
  const tiers = Array.isArray(dog.tiers) ? dog.tiers : [];
  for (const tier of tiers) {
    const min = Number(tier?.min);
    const max = tier?.max == null ? Infinity : Number(tier.max);
    if (Number.isFinite(min) && value >= min && value <= max) return Math.max(0, Number(tier.bonusWins) || 0);
  }
  if (value >= 20) return 3;
  if (value >= 10) return 2;
  return 1;
}

export function getGroupSideBetSettings(context: GroupContext) {
  const settings = context.rules?.sideBets || {};
  return {
    enabled: settings.enabled !== false,
    maxAmount: Number.isFinite(Number(settings.maxAmount)) ? Number(settings.maxAmount) : 20,
    maxPerWeek: Number.isFinite(Number(settings.maxPerWeek)) ? Number(settings.maxPerWeek) : 3
  };
}

export function getGroupGameLockTime(context: GroupContext, commenceTimeIso: string) {
  return getGameLockTime(commenceTimeIso, context.group.timezone);
}

export function getGroupSpreadFreezeTime(context: GroupContext, commenceTimeIso: string) {
  return getSpreadFreezeTime(commenceTimeIso, context.group.timezone);
}
