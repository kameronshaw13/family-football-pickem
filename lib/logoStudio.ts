import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "./cbsLogos.ts";

export type LogoEra = "modern" | "vintage";
export type LogoChoice = { modern?: string; vintage?: string };
export type LogoStudioPreferences = {
  era: LogoEra;
  choices: Record<string, LogoChoice>;
  vintageDefaults: Record<string, string>;
};
export const LOGO_STUDIO_EVENT = "pickem-logo-studio-changed";
const EMPTY: LogoStudioPreferences = { era: "modern", choices: {}, vintageDefaults: {} };
let activeUser = "";
let preferences: LogoStudioPreferences = EMPTY;

export function validLogoUrl(url: string): boolean {
  try {
    const value = new URL(url);
    return value.protocol === "https:" && !value.username && !value.password
      && !/(?:^|\.)(?:localhost|local|internal)$/i.test(value.hostname)
      && !/^\d+\.\d+\.\d+\.\d+$/.test(value.hostname)
      && url.length <= 1200;
  } catch { return false; }
}

// All variants of a school's ESPN URL resolve to the same CBS asset identity.
export function logoKeyFromSource(source: string | null | undefined): string | null {
  if (!source || !/^https?:\/\/(?:a|secure)\.espncdn\.com\//i.test(source)) return null;
  const match = source.match(/\/teamlogos\/(ncaa|nba|nfl)\/(?:[^/?#]+\/)*([^/?.#]+)\.(?:png|svg|webp)(?:[?#]|$)/i);
  if (match) {
    const league = match[1].toLowerCase();
    const key = match[2].toLowerCase();
    const mapped = CBS_BY_LEAGUE[league]?.[key];
    return mapped ? `cbs:${mapped}` : `${league}:${key}`;
  }
  const guid = source.match(/\/guid\/([^/]+)\/logos\//i)?.[1]?.toLowerCase();
  if (guid) return CBS_BY_ESPN_GUID[guid] ? `cbs:${CBS_BY_ESPN_GUID[guid]}` : `guid:${guid}`;
  return null;
}

export function getLogoStudioPreferences(): LogoStudioPreferences { return preferences; }

export function setLogoStudioUser(profileId: string) {
  if (typeof window === "undefined" || !profileId || activeUser === profileId) return;
  activeUser = profileId;
  try {
    const stored = JSON.parse(window.localStorage.getItem(`pickem_logo_studio:${profileId}`) || "{}");
    preferences = {
      era: stored?.era === "vintage" ? "vintage" : "modern",
      choices: stored?.choices && typeof stored.choices === "object" && !Array.isArray(stored.choices) ? stored.choices : {},
      vintageDefaults: stored?.vintageDefaults && typeof stored.vintageDefaults === "object" && !Array.isArray(stored.vintageDefaults) ? stored.vintageDefaults : {}
    };
  } catch { preferences = { era: "modern", choices: {}, vintageDefaults: {} }; }
  document.documentElement.dataset.logoEra = preferences.era;
  window.dispatchEvent(new Event(LOGO_STUDIO_EVENT));
}

export function saveLogoStudioPreferences(value: LogoStudioPreferences) {
  preferences = value;
  if (typeof window === "undefined") return;
  document.documentElement.dataset.logoEra = value.era;
  if (activeUser) {
    try { window.localStorage.setItem(`pickem_logo_studio:${activeUser}`, JSON.stringify(value)); }
    catch { /* Rendering works if storage is disabled. */ }
  }
  window.dispatchEvent(new Event(LOGO_STUDIO_EVENT));
}

export function resolvePersonalLogo(source: string): string | null {
  const key = logoKeyFromSource(source);
  if (!key) return null;
  const era = preferences.era;
  const selected = preferences.choices[key]?.[era];
  if (typeof selected === "string" && validLogoUrl(selected)) return selected;
  if (era === "vintage") {
    const old = preferences.vintageDefaults[key];
    if (typeof old === "string" && validLogoUrl(old)) return old;
  }
  return null;
}
