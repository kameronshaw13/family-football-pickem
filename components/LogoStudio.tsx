"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { collegeHistoricalImageSource } from "@/lib/collegeLogoImage";
import { curatedLogoAlternatives, type LogoAlternative } from "@/lib/logoExtraOptions";
import {
  getLogoStudioPreferences, getPublishedLogoCollections, setPublishedLogoCollection, setViewerLogoEra, LOGO_STUDIO_EVENT,
  saveLogoStudioPreferences, persistLogoStudioDrafts, waitForLogoStudioDrafts, validLogoUrl, type LogoEra, type LogoStudioPreferences
} from "@/lib/logoStudio";
import { ncaaSvgLogo, teamVectorFallbackLogo, teamVectorLogo } from "@/lib/teamLogoSource";
import { NBA_SVG_BY_ESPN_KEY } from "@/lib/proLogos";
import { schoolSiteLogo } from "@/lib/officialSchoolLogos";

type Team = { league: string; name: string; logo: string; key: string };
type Option = { label: string; url: string; historical?: boolean; year?: number };
const LEAGUES = ["College", "NBA", "NFL"];

function LogoOptionTile({ option, chosen, onSelect }: { option: Option; chosen: boolean; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <button className={chosen ? "logo-studio-option selected" : "logo-studio-option"} aria-pressed={chosen}
    type="button" onClick={onSelect}>
    <Image unoptimized src={collegeHistoricalImageSource(option.url)} width={52} height={52} alt="" loading="lazy"
      onError={() => setFailed(true)} />
    <span>{option.label}</span>
  </button>;
}
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function LogoStudio({ profileId }: { profileId: string }) {
  const [prefs, setPrefs] = useState<LogoStudioPreferences>(getLogoStudioPreferences());
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState("College");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Team | null>(null);
  const [history, setHistory] = useState<Option[]>([]);
  const [extra, setExtra] = useState<LogoAlternative[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [message, setMessage] = useState("");
  const [custom, setCustom] = useState("");
  const [savingEra, setSavingEra] = useState<LogoEra | null>(null);
  const [collegeAvailable, setCollegeAvailable] = useState(true);

  useEffect(() => {
    const sync = () => setPrefs({ ...getLogoStudioPreferences() });
    sync();
    window.addEventListener(LOGO_STUDIO_EVENT, sync);
    return () => window.removeEventListener(LOGO_STUDIO_EVENT, sync);
  }, [profileId]);

  const loadTeams = useCallback(async () => {
    if (teams.length) return teams;
    setLoadingTeams(true);
    try {
      const response = await fetch("/api/logo-studio", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error("Could not load team directory.");
      const list: Team[] = data.teams || [];
      setTeams(list);
      setCollegeAvailable(data.collegeAvailable !== false);
      return list;
    } catch {
      setMessage("Team directory could not be loaded. Try opening Logo Studio again.");
      return [];
    } finally { setLoadingTeams(false); }
  }, [teams]);


  async function changeEra(era: LogoEra) {
    try {
      await setViewerLogoEra(era);
      setMessage("");
    } catch { setMessage("Could not save your viewing style. Please try again."); }
  }

  async function publishCollection(era: LogoEra) {
    if (savingEra) return;
    setSavingEra(era);
    setMessage("");
    try {
      // Flush in-flight draft changes before publishing the collection.
      await waitForLogoStudioDrafts().catch(() => {});
      // Read current published artwork at save time to avoid erasing anyone's
      // collection if it was updated in another tab.
      const authToken = window.localStorage.getItem("pickem_session_token") || "";
      const existing = await fetch("/api/logo-presets", { cache: "no-store", headers: authToken ? { Authorization: "Bearer " + authToken } : {} });
      if (!existing.ok) throw new Error("Could not load saved collections.");
      const data = await existing.json();
      if (!data.ok || !data.canEdit) throw new Error("Logo publishing is unavailable.");
      const logos: Record<string, string> = { ...(data.presets?.[era] || {}) };
      const latest = getLogoStudioPreferences();
      for (const [key, choice] of Object.entries(latest.choices)) {
        const url = choice?.[era];
        if (url === undefined) continue;
        if (url === null) delete logos[key];
        else if (validLogoUrl(url)) logos[key] = url;
      }
      const token = authToken;
      const response = await fetch("/api/logo-presets", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({ era, logos })
      });
      if (!response.ok) throw new Error("Could not publish team logos.");
      setPublishedLogoCollection(era, logos);
      const choices: LogoStudioPreferences["choices"] = {};
      for (const [key, choice] of Object.entries(latest.choices)) {
        const remaining = { ...choice };
        if (remaining[era] !== null) delete remaining[era];
        if (Object.keys(remaining).length) choices[key] = remaining;
      }
      saveLogoStudioPreferences({ ...latest, choices });
      await persistLogoStudioDrafts(choices);
      setMessage(`${era === "modern" ? "Modern" : "Vintage"} logos saved for everyone. ${Object.keys(logos).length} custom team logos published; others keep their built-in logos.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save logo collection.");
    } finally { setSavingEra(null); }
  }


  useEffect(() => { void loadTeams(); }, [loadTeams]);

  useEffect(() => {
    let canceled = false;
    setHistory([]);
    setExtra([]);
    setCustom("");
    setLoadingHistory(false);
    if (active) {
      const params = new URLSearchParams({ league: active.league === "College" ? "CBB" : active.league, name: active.name, logo: active.logo });
      void fetch("/api/logo-alternatives?" + params.toString())
        .then(res => res.json())
.then(data => { if (!canceled) setExtra(data.ok ? (data.options || []) : []); })
        .catch(() => { if (!canceled) setExtra([]); });
      if (["NBA", "NFL", "College"].includes(active.league)) {
        setLoadingHistory(true);
        void fetch((active.league === "College"
          ? "/api/college-logo-history?league=CBB&team=" + encodeURIComponent(active.name)
          : "/api/logo-history?league=" + active.league.toLowerCase() + "&team=" + encodeURIComponent(active.name)))
          .then(res => res.json())
          .then(data => {
            if (canceled) return;
            const matches: Option[] = (data.logos || [])
              .filter((item: Option) => validLogoUrl(item.url))
              .slice(0, 16).map((item: Option) => ({ ...item, historical: true }));
            setHistory(matches);

          })
          .catch(() => { if (!canceled) setHistory([]); })
          .finally(() => { if (!canceled) setLoadingHistory(false); });
      }
    }
    return () => { canceled = true; };
  }, [active]);

  const filtered = useMemo(() => teams.filter(team => team.league === league
    && (!search || normalized(team.name).includes(normalized(search))))
    .sort((a, b) => a.name.localeCompare(b.name)), [teams, league, search]);

  const modernSelected = active
    ? prefs.choices[active.key]?.modern === null ? null
      : prefs.choices[active.key]?.modern ?? getPublishedLogoCollections().modern[active.key] ?? null
    : null;
  const vintageSelected = active
    ? prefs.choices[active.key]?.vintage === null ? null
      : prefs.choices[active.key]?.vintage ?? getPublishedLogoCollections().vintage[active.key] ?? null
    : null;

  const options = useMemo(() => {
    const main: Option[] = [];
    const more: Option[] = [];
    const vintage: Option[] = [];
    if (!active) return { main, more, vintage };

    const add = (section: Option[], label: string, url?: string | null) => {
      if (!url || !validLogoUrl(url) || section.some(item => item.url === url)) return;
      if (section !== vintage && [...main, ...more].some(item => item.url === url)) return;
      section.push({ label, url });
    };
    const sport = active.league === "College" ? "CBB" : active.league;
    const school = active.league === "College" ? schoolSiteLogo(active.logo) : null;
    const nbaId = active.league === "NBA"
      ? active.logo.match(/\/teamlogos\/nba\/(?:[^/?#]+\/)*([a-z0-9_-]+)\.(?:png|svg|webp)(?:[?#]|$)/i)?.[1]
      : null;
    const nbaLogo = nbaId ? NBA_SVG_BY_ESPN_KEY[nbaId] : null;

    // First line: actual school-athletics site (if confirmed), ESPN and CBS.
    // An NCAA or alternate source fills the third spot only if the school-site
    // candidate is missing. No source is silently chosen as the user's default.
    if (school) add(main, "School website", school.url);
    else if (nbaLogo) add(main, "NBA.com", nbaLogo);
    add(main, "ESPN", active.logo);
    add(main, "CBS", teamVectorFallbackLogo(active.logo) || teamVectorLogo(active.logo));

    const curated = curatedLogoAlternatives(active.logo, sport);
    const otherLogo = active.league === "College" ? ncaaSvgLogo(active.logo)
      : curated.find(item => item.label === "NFL vector")?.url;
    if (main.length < 3) add(main, active.league === "College" ? "NCAA" : "Other source", otherLogo);
    if (main.length < 3) add(main, "Other source", extra[0]?.url || teamVectorLogo(active.logo));

    add(more, "CBS alternate", teamVectorLogo(active.logo));
    if (active.league === "College") add(more, "NCAA vector", ncaaSvgLogo(active.logo));
    for (const item of curated) {
      if (/\b(?:19\d{2}|20[01]\d)\b|vintage|historical|original/i.test(item.label))
        add(vintage, item.label, item.url);
      else add(more, item.label, item.url);
    }
    for (const item of extra) add(more, item.label, item.url);
    for (const item of history) add(vintage, item.label, item.url);

    if (modernSelected && ![...main, ...more].some(item => item.url === modernSelected))
      add(more, "Your saved Modern", modernSelected);
    if (vintageSelected && !vintage.some(item => item.url === vintageSelected))
      add(vintage, "Your saved Vintage", vintageSelected);
    return { main: main.slice(0, 3), more, vintage };
  }, [active, history, extra, modernSelected, vintageSelected]);

  function selectLogo(value: string | null, era: LogoEra) {
    if (!active) return;
    if (value !== null && !validLogoUrl(value)) { setMessage("Enter a valid HTTPS image URL."); return; }
    const latest = getLogoStudioPreferences();
    const nextChoices = { ...latest.choices };
    const selection = { ...(nextChoices[active.key] || {}) };
    selection[era] = value;
    nextChoices[active.key] = selection;
    const defaults = { ...latest.vintageDefaults };
    if (value === null && era === "vintage") delete defaults[active.key];
    saveLogoStudioPreferences({ ...latest, choices: nextChoices, vintageDefaults: defaults });
    setMessage(`Saving ${active.name} ${era} selection to your account…`);
    void persistLogoStudioDrafts(nextChoices)
      .then(() => setMessage(`${active.name} ${era} selection saved. Press Save ${era === "modern" ? "Modern" : "Vintage"} to publish your list for everyone.`))
      .catch(() => setMessage("Your selection is visible here but did not sync. Press Save Modern or Save Vintage to publish it permanently."));
  }


  return <div className="logo-studio-page">
    <div className="logo-studio-style-label"><strong>Logo collections</strong><span>Choose a logo from each source. Save your Modern and Vintage lists separately.</span></div>
    <div className="theme-toggle logo-studio-era" role="group" aria-label="Team logo style">
      <button type="button" aria-pressed={prefs.era === "modern"} className={prefs.era === "modern" ? "active" : ""} onClick={() => void changeEra("modern")}>Modern</button>
      <button type="button" aria-pressed={prefs.era === "vintage"} className={prefs.era === "vintage" ? "active" : ""} onClick={() => void changeEra("vintage")}>Vintage</button>
    </div>
    <div className="logo-studio-save-actions" role="group" aria-label="Publish team logo collections">
      <button type="button" disabled={Boolean(savingEra)} onClick={() => void publishCollection("modern")}>
        {savingEra === "modern" ? "Saving Modern…" : "Save Modern"}
      </button>
      <button type="button" disabled={Boolean(savingEra)} onClick={() => void publishCollection("vintage")}>
        {savingEra === "vintage" ? "Saving Vintage…" : "Save Vintage"}
      </button>
    </div>
    <div className="logo-studio-body">
        <div className="logo-studio-leagues" role="group" aria-label="Sport">
          {LEAGUES.map(sport => <button key={sport} type="button" className={league === sport ? "active" : ""} aria-pressed={league === sport} onClick={() => { setLeague(sport); setActive(null); }}>{sport}</button>)}
        </div>
        <label className="logo-studio-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all teams" aria-label="Search all teams" /></label>
        {!loadingTeams && <p className="logo-studio-count">{filtered.length} {filtered.length === 1 ? "team" : "teams"} · Alphabetical A–Z</p>}
        {loadingTeams && <p className="logo-studio-note">Loading teams…</p>}
        {!loadingTeams && !filtered.length && <p className="logo-studio-note">{league === "College" && !collegeAvailable ? "The Division I team directory is temporarily unavailable." : "No teams found."}</p>}
        <div className="logo-studio-teams">{filtered.map(team => {
          const selected = prefs.choices[team.key]?.[prefs.era];
          const shared = getPublishedLogoCollections()[prefs.era][team.key];
          const logo = (selected === null ? null : selected || shared) || (prefs.era === "vintage" && selected !== null ? prefs.vintageDefaults[team.key] : null) || teamVectorFallbackLogo(team.logo) || team.logo;
          return <button type="button" key={team.league + team.key} className={active?.key === team.key && active.league === team.league ? "logo-studio-team active" : "logo-studio-team"} onClick={() => { setActive(team); setMessage(""); }}>
            <Image unoptimized src={collegeHistoricalImageSource(logo)} alt="" width={35} height={35} loading="lazy" />
            <span>{team.name}</span>
            <ChevronDown size={14} />
          </button>;
        })}</div>

        {active && <div className="logo-studio-editor">
          <div className="logo-studio-editor-heading">
            <strong>{active.name}</strong><span>Choose the logos for your saved lists</span>
          </div>
          <div className="logo-studio-section">
            <h3 className="logo-studio-section-title">Modern · Main sources</h3>
            <div className="logo-studio-options logo-studio-main-sources">
              {options.main.map(option => <LogoOptionTile key={option.url} option={option}
                chosen={modernSelected === option.url} onSelect={() => selectLogo(option.url, "modern")} />)}
            </div>
            {active.league === "College" && options.main[0]?.label === "School website" &&
              <p className="logo-studio-source-note">School website artwork was checked on the school’s athletics homepage.</p>}
          </div>
          {options.more.length > 0 && <div className="logo-studio-section">
            <h3 className="logo-studio-section-title">More modern choices</h3>
            <div className="logo-studio-options">
              {options.more.map(option => <LogoOptionTile key={option.url} option={option}
                chosen={modernSelected === option.url} onSelect={() => selectLogo(option.url, "modern")} />)}
            </div>
          </div>}
          {(options.vintage.length > 0 || loadingHistory) && <div className="logo-studio-section">
            <h3 className="logo-studio-section-title">Vintage · Historical designs</h3>
            <div className="logo-studio-options">
              {options.vintage.map(option => <LogoOptionTile key={option.url} option={option}
                chosen={vintageSelected === option.url} onSelect={() => selectLogo(option.url, "vintage")} />)}
            </div>
            {loadingHistory && <p className="logo-studio-note">Loading vintage designs…</p>}
          </div>}
          <div className="logo-studio-reset-actions">
            <button type="button" onClick={() => selectLogo(null, "modern")}>Reset Modern choice</button>
            <button type="button" onClick={() => selectLogo(null, "vintage")}>Reset Vintage choice</button>
          </div>
          <div className="logo-studio-custom">
            <input type="url" value={custom} onChange={event => setCustom(event.target.value)} placeholder="Optional custom logo URL" aria-label="Custom team logo HTTPS URL" />
            <button type="button" disabled={!validLogoUrl(custom)}
              onClick={() => { selectLogo(custom, prefs.era); setCustom(""); }}>Use for {prefs.era === "modern" ? "Modern" : "Vintage"}</button>
          </div>
        </div>}
        <p className="logo-studio-note">Pick logos manually, then Save Modern or Save Vintage to make that list the default for everyone. Your existing choices stay saved until you change them.</p>
    </div>
    {message && <p className="logo-studio-status" role="status">{message}</p>}
  </div>;
}
