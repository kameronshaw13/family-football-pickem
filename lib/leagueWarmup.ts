import type { PickemAppSlug } from "./authUsers";
import { getClientSessionToken } from "./clientSession";
import { appDataCacheKey, readCachedAppData, type AppData, type AppDataCacheEntry } from "@/components/PickemPresentationShared";

/** Shares in-flight league requests between Settings selection and tab navigation. */
const inFlight = new Map<string, Promise<boolean>>();

export function warmLeagueData(slug: PickemAppSlug, week: number | null = null): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (readCachedAppData(slug, week)) return Promise.resolve(true);
  const key = appDataCacheKey(slug, week);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = (async () => {
    const token = getClientSessionToken();
    if (!token) return false;
    try {
      const url = new URL("/api/app-data", window.location.origin);
      if (week !== null) url.searchParams.set("week", String(week));
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}`, "x-pickem-group": slug },
        cache: "no-store"
      });
      if (!response.ok || token !== getClientSessionToken()) return false;
      const payload = await response.json() as AppData;
      const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null") as { id?: string } | null;
      if (!profile?.id || payload.currentUser?.id !== profile.id) return false;
      // A timer-based cache write races router.push and displays the loading shell.
      window.sessionStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), payload } satisfies AppDataCacheEntry));
      return true;
    } catch {
      return false;
    }
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}
