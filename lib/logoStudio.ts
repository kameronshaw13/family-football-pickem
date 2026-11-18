import { CBS_BY_ESPN_GUID, CBS_BY_LEAGUE } from "./cbsLogos.ts";

export type LogoEra = "modern" | "vintage";
export type LogoChoice = { modern?: string | null; vintage?: string | null };
export type LogoStudioPreferences = {
  era: LogoEra;
  choices: Record<string, LogoChoice>;
  vintageDefaults: Record<string, string>;
};
export const LOGO_STUDIO_EVENT = "pickem-logo-studio-changed";
const EMPTY: LogoStudioPreferences = { era: "modern", choices: {}, vintageDefaults: {} };
let activeUser = "";
let preferences: LogoStudioPreferences = EMPTY;
let editor = false;
let eraRevision = 0;
let published: Record<LogoEra, Record<string, string>> = { modern: {}, vintage: {} };

export function getPublishedLogoCollections() { return published; }
export function setPublishedLogoCollection(era: LogoEra, images: Record<string, string>) {
  const filtered: Record<string, string> = {};
  for (const [key, url] of Object.entries(images || {})) {
    if (/^(?:cbs|ncaa|nba|nfl|guid):[a-z0-9_-]{1,90}$/i.test(key) && validLogoUrl(url))
      filtered[key] = url;
  }
  published = { ...published, [era]: filtered };
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOGO_STUDIO_EVENT));
}
export function isLogoStudioEditor() { return editor; }

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

export function setLogoStudioUser(profileId: string, canEdit = false) {
  if (typeof window === "undefined" || !profileId || activeUser === profileId) return;
  activeUser = profileId;
  editor = canEdit;
  published = { modern: {}, vintage: {} };
  try {
    const stored = JSON.parse(window.localStorage.getItem(`pickem_logo_studio:${profileId}`) || "{}");
    preferences = {
      era: stored?.era === "vintage" ? "vintage" : "modern",
      choices: canEdit && stored?.choices && typeof stored.choices === "object" && !Array.isArray(stored.choices) ? stored.choices : {},
      vintageDefaults: canEdit && stored?.vintageCatalogVersion === 2 && stored?.vintageDefaults && typeof stored.vintageDefaults === "object" && !Array.isArray(stored.vintageDefaults) ? stored.vintageDefaults : {}
    };
  } catch { preferences = { era: "modern", choices: {}, vintageDefaults: {} }; }
  document.documentElement.dataset.logoEra = preferences.era;
  window.dispatchEvent(new Event(LOGO_STUDIO_EVENT));
  const currentUser = profileId;
  const readAtRevision = eraRevision;
  void fetch("/api/logo-presets", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Could not load published logos.");
      return response.json();
    })
    .then(data => {
      if (activeUser !== currentUser || !data?.ok) return;
      setPublishedLogoCollection("modern", data.presets?.modern || {});
      setPublishedLogoCollection("vintage", data.presets?.vintage || {});
      if (readAtRevision === eraRevision) {
        const remoteEra: LogoEra = data.era === "vintage" ? "vintage" : "modern";
        saveLogoStudioPreferences({ ...preferences, era: remoteEra });
      }
    }).catch(() => { /* Preserve local appearance if server is temporarily unavailable. */ });
}

export function saveLogoStudioPreferences(value: LogoStudioPreferences) {
  preferences = value;
  if (typeof window === "undefined") return;
  document.documentElement.dataset.logoEra = value.era;
  if (activeUser) {
    try { window.localStorage.setItem(`pickem_logo_studio:${activeUser}`, JSON.stringify({ ...value, vintageCatalogVersion: 2 })); }
    catch { /* Rendering works if storage is disabled. */ }
  }
  window.dispatchEvent(new Event(LOGO_STUDIO_EVENT));
}

export async function setViewerLogoEra(era: LogoEra): Promise<void> {
  const previous = preferences.era;
  if (previous === era) return;
  const userId = activeUser;
  eraRevision += 1;
  saveLogoStudioPreferences({ ...preferences, era });
  try {
    const token = window.localStorage.getItem("pickem_session_token") || "";
    const response = await fetch("/api/logo-era", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: JSON.stringify({ era })
    });
    if (!response.ok) throw new Error("Could not save your logo style.");
  } catch (error) {
    if (userId === activeUser && preferences.era === era)
      saveLogoStudioPreferences({ ...preferences, era: previous });
    throw error;
  }
}

export function resolvePersonalLogo(source: string): string | null {
  const key = logoKeyFromSource(source);
  if (!key) return null;
  const era = preferences.era;
  // Draft selections are visible only to the collection editor until published.
  const selected = editor ? preferences.choices[key]?.[era] : undefined;
  if (selected === null) return null;
  if (typeof selected === "string" && validLogoUrl(selected)) return selected;
  const shared = published[era][key];
  if (typeof shared === "string" && validLogoUrl(shared)) return shared;
  if (editor && era === "vintage") {
    const old = preferences.vintageDefaults[key];
    if (typeof old === "string" && validLogoUrl(old)) return old;
  }
  return null;
}
