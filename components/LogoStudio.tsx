"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Images, Search } from "lucide-react";
import {
  getLogoStudioPreferences, LOGO_STUDIO_EVENT,
  saveLogoStudioPreferences, validLogoUrl, type LogoEra, type LogoStudioPreferences
} from "@/lib/logoStudio";
import { ncaaSvgLogo, teamVectorFallbackLogo, teamVectorLogo } from "@/lib/teamLogoSource";

type Team = { league: string; name: string; logo: string; key: string };
type Option = { label: string; url: string; historical?: boolean };
type ArchiveEntry = { name: string; logos: { label: string; url: string; year: number }[] };
const LEAGUES = ["CBB", "CFB", "NBA", "NFL"];
const normalized = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const teamMatches = (row: ArchiveEntry, name: string) => {
  const a = normalized(row.name).replace("losangeles", "la");
  const b = normalized(name).replace("losangeles", "la");
  return a === b || a.includes(b) || b.includes(a);
};

export default function LogoStudio({ profileId }: { profileId: string }) {
  const [prefs, setPrefs] = useState<LogoStudioPreferences>(getLogoStudioPreferences());
  const [expanded, setExpanded] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [league, setLeague] = useState("CBB");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Team | null>(null);
  const [history, setHistory] = useState<Option[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [message, setMessage] = useState("");
  const [custom, setCustom] = useState("");

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
      ? `Vintage designs available for ${Object.keys(output).length} pro teams. Colleges keep current logos unless you choose another.`
      : "Vintage palette is active. Add historical designs individually where available.");
  }, []);

  async function changeEra(era: LogoEra) {
    const current = getLogoStudioPreferences();
    saveLogoStudioPreferences({ ...current, era });
    if (era === "vintage" && Object.keys(current.vintageDefaults).length === 0) {
      const list = await loadTeams();
      void loadVintageCatalog(list);
    } else setMessage("");
  }

  useEffect(() => {
    if (!expanded) return;
    void loadTeams();
  }, [expanded, loadTeams]);

  useEffect(() => {
    setHistory([]);
    setCustom("");
    if (!active || !["NBA", "NFL"].includes(active.league)) return;
    let canceled = false;
    setLoadingHistory(true);
    void fetch(`/api/logo-history?league=${active.league.toLowerCase()}&team=${encodeURIComponent(active.name)}`)
      .then(res => res.json())
      .then(data => {
        if (canceled) return;
        setHistory((data.logos || []).filter((item: Option) => validLogoUrl(item.url))
          .slice(0, 16).map((item: Option) => ({ ...item, historical: true })));
      })
      .catch(() => { if (!canceled) setHistory([]); })
      .finally(() => { if (!canceled) setLoadingHistory(false); });
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
    if (["CFB", "CBB"].includes(active.league)) add("NCAA vector", ncaaSvgLogo(active.logo));
    return [...result, ...history.filter(item => !result.some(previous => previous.url === item.url))];
  }, [active, history]);

  function selectLogo(value: string | null) {
    if (!active) return;
    if (value !== null && !validLogoUrl(value)) { setMessage("Enter a valid HTTPS image URL."); return; }
    const latest = getLogoStudioPreferences();
    const nextChoices = { ...latest.choices };
    const selection = { ...(nextChoices[active.key] || {}) };
    if (value) selection[latest.era] = value;
    else delete selection[latest.era];
    if (selection.modern || selection.vintage) nextChoices[active.key] = selection;
    else delete nextChoices[active.key];
    saveLogoStudioPreferences({ ...latest, choices: nextChoices });
    setMessage(value ? `Saved ${active.name} for ${latest.era} mode.` : "Restored automatic logo selection.");
  }

  const chosen = active ? prefs.choices[active.key]?.[prefs.era] : null;
  const automatic = active
    ? prefs.era === "vintage" ? prefs.vintageDefaults[active.key] || teamVectorFallbackLogo(active.logo) || active.logo
      : teamVectorFallbackLogo(active.logo) || active.logo
    : "";

  return <div className="settings-card logo-studio-card">
    <div className="settings-row-heading logo-studio-heading">
      <span className="settings-leading-icon"><Images size={17} /></span>
      <span className="settings-row-copy"><strong>Logo Studio</strong><span>Switch styles and choose individual team logos.</span></span>
    </div>
    <div className="theme-toggle logo-studio-era" role="group" aria-label="Team logo style">
      <button type="button" aria-pressed={prefs.era === "modern"} className={prefs.era === "modern" ? "active" : ""} onClick={() => void changeEra("modern")}>Modern</button>
      <button type="button" aria-pressed={prefs.era === "vintage"} className={prefs.era === "vintage" ? "active" : ""} onClick={() => void changeEra("vintage")}>Vintage</button>
    </div>
    <details className="logo-studio-detail" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
      <summary>Choose team logos <ChevronDown size={16} /></summary>
      <div className="logo-studio-body">
        <div className="logo-studio-leagues" role="group" aria-label="Sport">
          {LEAGUES.map(sport => <button key={sport} type="button" className={league === sport ? "active" : ""} aria-pressed={league === sport} onClick={() => { setLeague(sport); setActive(null); }}>{sport}</button>)}
        </div>
        <label className="logo-studio-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teams" aria-label="Search teams" /></label>
        {loadingTeams && <p className="logo-studio-note">Loading teams…</p>}
        {!loadingTeams && !filtered.length && <p className="logo-studio-note">No teams found.</p>}
        <div className="logo-studio-teams">{filtered.slice(0, 160).map(team => {
          const selected = prefs.choices[team.key]?.[prefs.era];
          const logo = selected || (prefs.era === "vintage" ? prefs.vintageDefaults[team.key] : null) || teamVectorFallbackLogo(team.logo) || team.logo;
          return <button type="button" key={team.league + team.key} className={active?.key === team.key && active.league === team.league ? "logo-studio-team active" : "logo-studio-team"} onClick={() => { setActive(team); setMessage(""); }}>
            <img src={logo} alt="" width={35} height={35} loading="lazy" />
            <span>{team.name}</span>
            <ChevronDown size={14} />
          </button>;
        })}</div>
        {active && <div className="logo-studio-editor">
          <div className="logo-studio-editor-heading"><strong>{active.name}</strong><span>{prefs.era === "vintage" ? "Vintage" : "Modern"} artwork</span></div>
          <div className="logo-studio-options">
            <button className={!chosen ? "logo-studio-option selected" : "logo-studio-option"} type="button" aria-pressed={!chosen} onClick={() => selectLogo(null)}>
              <img src={automatic} width={52} height={52} alt="" />
              <span>Automatic</span>
            </button>
            {options.map(option => <button key={option.url} className={chosen === option.url ? "logo-studio-option selected" : "logo-studio-option"} aria-pressed={chosen === option.url} type="button" onClick={() => selectLogo(option.url)}>
              <img src={option.url} width={52} height={52} alt="" loading="lazy" onError={event => { event.currentTarget.style.opacity = ".25"; }} />
              <span>{option.label}</span>
            </button>)}
          </div>
          {loadingHistory && <p className="logo-studio-note">Finding historical logos…</p>}
          {["CFB", "CBB"].includes(active.league) && <p className="logo-studio-note">College historical logos vary by school. Add an image URL to use one you like.</p>}
          <div className="logo-studio-custom">
            <input type="url" value={custom} onChange={event => setCustom(event.target.value)} placeholder="Paste PNG, SVG or WebP image URL" aria-label="Custom team logo HTTPS URL" />
            <button type="button" disabled={!validLogoUrl(custom)} onClick={() => { selectLogo(custom); setCustom(""); }}>Use logo</button>
          </div>
        </div>}
        <p className="logo-studio-note">Changes are personal to this account on this device. Game data and other players are unaffected.</p>
      </div>
    </details>
    {message && <p className="logo-studio-status" role="status">{message}</p>}
  </div>;
}
