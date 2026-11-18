"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import Image from "next/image";
import { collegeHistoricalImageSource } from "@/lib/collegeLogoImage";
import { curatedLogoAlternatives, type LogoAlternative } from "@/lib/logoExtraOptions";
import {
  getLogoStudioPreferences, getPublishedLogoCollections, setPublishedLogoCollection, setViewerLogoEra, LOGO_STUDIO_EVENT,
  saveLogoStudioPreferences, validLogoUrl, type LogoEra, type LogoStudioPreferences
} from "@/lib/logoStudio";
import { ncaaSvgLogo, teamVectorFallbackLogo, teamVectorLogo } from "@/lib/teamLogoSource";

type Team = { league: string; name: string; logo: string; key: string };
type Option = { label: string; url: string; historical?: boolean; year?: number };
type ArchiveEntry = { name: string; logos: { label: string; url: string; year: number }[] };
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
const teamMatches = (row: ArchiveEntry, name: string) => {
  const a = normalized(row.name).replace(/^la(?=clippers|lakers|rams|chargers)/, "losangeles");
  const b = normalized(name).replace(/^la(?=clippers|lakers|rams|chargers)/, "losangeles");
  return a === b;
};

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

  const loadVintageCatalog = useCallback(async (knownTeams: Team[]) => {
    if (!knownTeams.length) return;
    setMessage("Finding historical NBA and NFL logo designs…");
    const output: Record<string, string> = {};
    await Promise.all((["nba", "nfl"] as const).map(async sport => {
      try {
        const response = await fetch(`/api/logo-history?league=${sport}`);
        if (!response.ok) return;
        const payload = await response.json();
        const archive: ArchiveEntry[] = payload.teams || [];
        for (const team of knownTeams.filter(t => t.league.toLowerCase() === sport)) {
          const choices = archive.find(row => teamMatches(row, team.name))?.logos || [];
          // A genuinely older design, not CBS's alternate current SVG.
          const older = choices.find(logo => logo.year <= 2005) || choices[choices.length - 1];
          if (older && validLogoUrl(older.url)) output[team.key] = older.url;
        }
      } catch { /* Archive is best-effort and never blocks the preference. */ }
    }));
    // Preserve manually selected images and any existing vintage selections.
    const latest = getLogoStudioPreferences();
    saveLogoStudioPreferences({ ...latest, vintageDefaults: { ...output, ...latest.vintageDefaults } });
    setMessage(Object.keys(output).length
      ? `Vintage designs available for ${Object.keys(output).length} pro teams. For colleges, select a school to see its historical artwork.`
      : "Vintage palette is active. College historical designs are available in the team picker.");
  }, []);

  async function changeEra(era: LogoEra) {
    const current = getLogoStudioPreferences();
    try {
      await setViewerLogoEra(era);
      if (era === "vintage" && Object.keys(current.vintageDefaults).length === 0) {
        const list = await loadTeams();
        void loadVintageCatalog(list);
      } else setMessage("");
    } catch { setMessage("Could not save your viewing style. Please try again."); }
  }

  async function publishCollection(era: LogoEra) {
    if (savingEra) return;
    setSavingEra(era);
    setMessage("");
    try {
      // Read current published artwork at save time to avoid erasing anyone's
      // collection if it was updated in another tab.
      const existing = await fetch("/api/logo-presets", { cache: "no-store" });
      if (!existing.ok) throw new Error("Could not load saved collections.");
      const data = await existing.json();
      if (!data.ok || !data.canEdit) throw new Error("Logo publishing is unavailable.");
      const logos: Record<string, string> = { ...(data.presets?.[era] || {}) };
      const latest = getLogoStudioPreferences();
      if (era === "vintage") for (const [key, url] of Object.entries(latest.vintageDefaults)) {
        if (!(key in logos) && validLogoUrl(url)) logos[key] = url;
      }
      for (const [key, choice] of Object.entries(latest.choices)) {
        const url = choice?.[era];
        if (url === undefined) continue;
        if (url === null) delete logos[key];
        else if (validLogoUrl(url)) logos[key] = url;
      }
      const token = window.localStorage.getItem("pickem_session_token") || "";
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
        delete remaining[era];
        if (Object.keys(remaining).length) choices[key] = remaining;
      }
      saveLogoStudioPreferences({ ...latest, choices });
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
      const params = new URLSearchParams({ league: active.league === "College" ? "CBB" : active.league, name: active.name });
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
            // The vintage switch can automatically use the school's older artwork
            // after that thumbnail actually loads. A manual choice always wins.
            if (active.league === "College") {
              const available = matches.filter(item => item.year && item.year < 2020);
              const choice = [...available.filter(item => item.year! <= 2005)].sort((a,b)=>(b.year||0)-(a.year||0))[0]
                || [...available].sort((a,b)=>(a.year||0)-(b.year||0))[0];
              if (choice) {
                const preview = new window.Image();
                preview.onload = () => {
                  if (canceled) return;
                  const latest = getLogoStudioPreferences();
                  if (latest.vintageDefaults[active.key] || latest.choices[active.key]?.vintage) return;
                  saveLogoStudioPreferences({ ...latest, vintageDefaults: {
                    ...latest.vintageDefaults, [active.key]: choice.url
                  } });
                };
                preview.src = collegeHistoricalImageSource(choice.url);
              }
            }
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

  const options = useMemo(() => {
    if (!active) return [];
    const result: Option[] = [];
    const add = (label: string, url?: string | null) => {
      if (url && validLogoUrl(url) && !result.some(item => item.url === url)) result.push({ label, url });
    };
    add("CBS standard", teamVectorFallbackLogo(active.logo));
    if (teamVectorFallbackLogo(active.logo)) add("CBS alternate", teamVectorLogo(active.logo));
    add("ESPN", active.logo);
    if (active.league === "College") add("NCAA vector", ncaaSvgLogo(active.logo));
    for (const item of curatedLogoAlternatives(active.logo, active.league === "College" ? "CBB" : active.league)) add(item.label, item.url);
    for (const item of extra) add(item.label, item.url);
    for (const item of history) add(item.label, item.url);
    return result;
  }, [active, history, extra]);


  function selectLogo(value: string | null) {
    if (!active) return;
    if (value !== null && !validLogoUrl(value)) { setMessage("Enter a valid HTTPS image URL."); return; }
    const latest = getLogoStudioPreferences();
    const nextChoices = { ...latest.choices };
    const selection = { ...(nextChoices[active.key] || {}) };
    selection[latest.era] = value;
    nextChoices[active.key] = selection;
    saveLogoStudioPreferences({ ...latest, choices: nextChoices });
    setMessage(value ? `Saved ${active.name} for ${latest.era} mode.` : "Restored automatic logo selection.");
  }

  const savedForEra = getPublishedLogoCollections()[prefs.era];
  const chosen = active
    ? (prefs.choices[active.key]?.[prefs.era] === null ? null
      : prefs.choices[active.key]?.[prefs.era] ?? savedForEra[active.key] ?? null)
    : null;
  const automatic = active
    ? prefs.era === "vintage" ? prefs.vintageDefaults[active.key] || teamVectorFallbackLogo(active.logo) || active.logo
      : teamVectorFallbackLogo(active.logo) || active.logo
    : "";

  return <div className="logo-studio-page">
    <div className="logo-studio-style-label"><strong>Team artwork style</strong><span>Choose a look, then customize individual teams.</span></div>
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
          const logo = (selected === null ? null : selected || shared) || (prefs.era === "vintage" ? prefs.vintageDefaults[team.key] : null) || teamVectorFallbackLogo(team.logo) || team.logo;
          return <button type="button" key={team.league + team.key} className={active?.key === team.key && active.league === team.league ? "logo-studio-team active" : "logo-studio-team"} onClick={() => { setActive(team); setMessage(""); }}>
            <Image unoptimized src={collegeHistoricalImageSource(logo)} alt="" width={35} height={35} loading="lazy" />
            <span>{team.name}</span>
            <ChevronDown size={14} />
          </button>;
        })}</div>
        {active && <div className="logo-studio-editor">
          <div className="logo-studio-editor-heading"><strong>{active.name}</strong><span>{prefs.era === "vintage" ? "Vintage" : "Modern"} artwork</span></div>
          <div className="logo-studio-options">
            <button className={!chosen ? "logo-studio-option selected" : "logo-studio-option"} type="button" aria-pressed={!chosen} onClick={() => selectLogo(null)}>
              <Image unoptimized src={collegeHistoricalImageSource(automatic)} width={52} height={52} alt="" />
              <span>Automatic</span>
            </button>
            {options.map(option => <LogoOptionTile key={option.url} option={option}
              chosen={chosen === option.url} onSelect={() => selectLogo(option.url)} />)}
          </div>
          {loadingHistory && <p className="logo-studio-note">Finding historical logos…</p>}
          {active.league === "College" && <p className="logo-studio-note">Historical designs appear above when available for this school. You can also paste an image URL. Historical images: <a href="https://sportslogohistory.com/" target="_blank" rel="noopener noreferrer">SportsLogoHistory.com</a>.</p>}
          <div className="logo-studio-custom">
            <input type="url" value={custom} onChange={event => setCustom(event.target.value)} placeholder="Paste PNG, SVG or WebP image URL" aria-label="Custom team logo HTTPS URL" />
            <button type="button" disabled={!validLogoUrl(custom)} onClick={() => { selectLogo(custom); setCustom(""); }}>Use logo</button>
          </div>
        </div>}
        <p className="logo-studio-note">Changes are personal to this account on this device. Game data and other players are unaffected.</p>
    </div>
    {message && <p className="logo-studio-status" role="status">{message}</p>}
  </div>;
}
