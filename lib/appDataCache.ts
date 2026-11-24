/** App-data cache shared by league warmup and the Pick'em UI.
 * This module must not import React components; doing so creates a cycle
 * through LeagueSwitcher, SettingsPanel, and the presentation shell.
 */
import type { BankEntry, BankSettings, Game, Pick, Profile, SideBet, Standing, WeekRule } from "@/lib/types";
import type { BankHistoryWeek } from "@/lib/bankHistory";
import type { AppSlug, GroupRules } from "@/lib/rulePresentation";

export type AppData = {
  currentUser: Profile;
  profiles: Profile[];
  games: Game[];
  picks: Pick[];
  standings: Standing[];
  weeklyStandingsByWeek: Record<string, Standing[]>;
  bankSettings: BankSettings;
  bankEntries: BankEntry[];
  bankHistory: BankHistoryWeek[];
  bankBalances?: Record<string, number>;
  bankAvailable?: Record<string, number>;
  bankReserved?: Record<string, number>;
  sideBets: SideBet[];
  sideBetLedger: SideBet[];
  sideBetSlotCounts: Record<string, number>;
  sideBetBankTotals: Record<string, number>;
  sideBetWeekTotals?: Record<string, number>;
  week: number;
  currentWeek?: number;
  weekRule: WeekRule;
  weekOpenTime: string | null;
  sideBetWeekOpenTime?: string | null;
  availableWeeks: number[];
  activeGroup?: { id: string; slug: string; name?: string };
  groupRules?: GroupRules;
  sideBetSettings?: { enabled: boolean; maxAmount: number | null; maxPerWeek: number | null; manualAmount: boolean };
  groupMoney?: { weeklyAmount: number; seasonAmount: number; weeklySubmitted: boolean; seasonSubmitted: boolean; canEdit: boolean; managerName: string | null };
};
export type AppDataCacheEntry = {
  cachedAt: number;
  payload: AppData;
};
export const APP_DATA_CACHE_PREFIX = "pickem_app_data_v2";
export const APP_DATA_CACHE_MAX_AGE = 15 * 60 * 1000;
export function appDataCacheKey(appSlug: AppSlug, week: number | null) {
  return `${APP_DATA_CACHE_PREFIX}:${appSlug}:${week == null ? "default" : week}`;
}

export function readCachedAppData(appSlug: AppSlug, week: number | null) {
  const key = appDataCacheKey(appSlug, week);
  try {
    const stored = window.sessionStorage.getItem(key);
    if (!stored) return null;
    const entry = JSON.parse(stored) as AppDataCacheEntry;
    const storedProfile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null") as Profile | null;
    if (!entry?.payload?.currentUser || !storedProfile || entry.payload.currentUser.id !== storedProfile.id || Date.now() - entry.cachedAt > APP_DATA_CACHE_MAX_AGE) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return entry.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

export function writeCachedAppData(appSlug: AppSlug, week: number | null, payload: AppData) {
  window.setTimeout(() => {
    try {
      window.sessionStorage.setItem(appDataCacheKey(appSlug, week), JSON.stringify({ cachedAt: Date.now(), payload } satisfies AppDataCacheEntry));
    } catch {
      // The app still works normally if private browsing or storage limits block this cache.
    }
  }, 0);
}

