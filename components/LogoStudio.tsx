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
import { draftRecommendedModernLogos, recommendedModernLogo } from "@/lib/logoRecommendation";
import { verifiedSchoolLogo, countVerifiedSchoolLogos } from "@/lib/verifiedSchoolLogos";

type Team = { league: string; name: string; logo: string; key: string };
type Option = { label: string; url: string; historical?: boolean; year?: number };
type ArchiveEntry = { name: string; logos: { label: string; url: string; year: number }[] };
const LEAGUES = ["College", "NBA", "NFL"];

function LogoOptionTile({ option, chosen, onSelect }: { option: Option; chosen: boolean; onSelect: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="logo-studio-option logo-studio-unavailable" aria-label={`${option.label} unavailable`}><span>Unavailable</span><span>{option.label}</span></div>;
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
  const [referenceColors, setReferenceColors] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
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
      if (era === "vintage") for (const [key, url] of Object.entries(latest.vintageDefaults)) {
        if (!(key in logos) && validLogoUrl(url)) logos[key] = url;
      }
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

  async function prepareModernDefaults() {
    if (savingEra || preparing) return;
    setPreparing(true);
    setMessage("");
    try {
      const list = teams.length ? teams : await loadTeams();
      if (!list.length) throw new Error("Team directory unavailable. Try again.");
      const latest = getLogoStudioPreferences();
      const next = draftRecommendedModernLogos(list, latest.choices, getPublishedLogoCollections().modern);
      if (!next.added) { setMessage("No uncustomized teams need a Modern recommendation. Existing choices were kept."); return; }
      saveLogoStudioPreferences({ ...latest, choices: next.choices });
      await persistLogoStudioDrafts(next.choices);
      setMessage(`${next.added} Modern recommendations saved to your account. Select Save Modern to publish them for everyone. Existing picks were kept. Sources: ${Object.entries(next.bySource).map(([key, count]) => key + " " + count).join("; ")}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare recommendations.");
    } finally { setPreparing(false); }
  }

  useEffect(() => { void loadTeams(); }, [loadTeams]);

  useEffect(() => {
    let canceled = false;
    setHistory([]);
    setExtra([]);
    setReferenceColors([]);
    setCustom("");
    setLoadingHistory(false);
    if (active) {
      const params = new URLSearchParams({ league: active.league === "College" ? "CBB" : active.league, name: active.name, logo: active.logo });
      void fetch("/api/logo-alternatives?" + params.toString())
        .then(res => res.json())
        .then(data => { if (!canceled) { setExtra(data.ok ? (data.options || []) : []); setReferenceColors(data.ok && Array.isArray(data.colors) ? data.colors : []); } })
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
                  if (latest.vintageDefaults[active.key] || Object.prototype.hasOwnProperty.call(latest.choices[active.key] || {}, "vintage")) return;
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

  const schoolLogo = active?.league === "College" ? verifiedSchoolLogo(active.logo) : null;
  const primary = useMemo(() => {
    if (!active) return [];
    const options: Option[] = [];
    let other: Option | null = null;
    if (active.league === "College") {
      const school = verifiedSchoolLogo(active.logo);
      const ncaa = ncaaSvgLogo(active.logo);
      other = school ? { label: "School website", url: school.url }
        : ncaa ? { label: "NCAA.com", url: ncaa }
        : extra.length ? { label: "Other source", url: extra[0].url } : null;
    } else if (active.league === "NBA") {
      const leagueLogo = recommendedModernLogo(active);
      other = leagueLogo ? { label: "NBA.com", url: leagueLogo.url } : null;
    } else {
      const alternative = extra.find(item => /footylogos|symbol|mascot/i.test(item.label));
      other = alternative ? { label: "Other source", url: alternative.url } : null;
    }
    if (other && validLogoUrl(other.url)) options.push(other);
    if (validLogoUrl(active.logo)) options.push({ label: "ESPN", url: active.logo });
    const cbs = teamVectorLogo(active.logo) || teamVectorFallbackLogo(active.logo);
    if (cbs && validLogoUrl(cbs)) options.push({ label: "CBS", url: cbs });
    return options;
  }, [active, extra]);

  const otherOptions = useMemo(() => {
    if (!active) return [];
    const used = new Set(primary.map(option => option.url));
    const result: Option[] = [];
    const add = (label: string, url?: string | null) => {
      if (url && validLogoUrl(url) && !used.has(url)) {
        used.add(url);
        result.push({ label, url });
      }
    };
    add("CBS standard", teamVectorFallbackLogo(active.logo));
    if (active.league === "College") add("NCAA vector", ncaaSvgLogo(active.logo));
    const preferred = recommendedModernLogo(active);
    if (preferred) add(preferred.source, preferred.url);
    for (const item of curatedLogoAlternatives(active.logo, active.league === "College" ? "CBB" : active.league))
      add(item.label, item.url);
    for (const item of extra) add(item.label, item.url);
    result.sort((a, b) => Number(/symbol|mascot|secondary|icon|mark/i.test(b.label))
      - Number(/symbol|mascot|secondary|icon|mark/i.test(a.label)));
    return result;
  }, [active, extra, primary]);

  function chosenForEra(era: LogoEra) {
    if (!active) return null;
    const choice = prefs.choices[active.key]?.[era];
    if (choice === null) return null;
    return choice ?? getPublishedLogoCollections()[era][active.key] ?? null;
  }

  function selectLogo(value: string | null, era: LogoEra = prefs.era) {
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
    setMessage(`Saving ${active.name} ${era} logo to your account…`);
    void persistLogoStudioDrafts(nextChoices)
      .then(() => setMessage(`${active.name} ${era} logo saved. Press Save ${era === "modern" ? "Modern" : "Vintage"} to publish for everyone.`))
      .catch(() => setMessage("The selection appears here, but could not sync to your account. Try saving again."));
  }

  const automatic = active
    ? prefs.era === "vintage" && prefs.choices[active.key]?.vintage !== null
      ? prefs.vintageDefaults[active.key] || teamVectorFallbackLogo(active.logo) || active.logo
      : prefs.era === "modern"
        ? verifiedSchoolLogo(active.logo)?.url || ncaaSvgLogo(active.logo) || teamVectorFallbackLogo(active.logo) || active.logo
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
    <div className="logo-studio-bulk-action">
      <button type="button" disabled={preparing || Boolean(savingEra) || loadingTeams || teams.length === 0}
        onClick={() => void prepareModernDefaults()}>
        {preparing ? "Preparing recommendations…" : "Fill recommended Modern logos for all untouched teams"}
      </button>
      <span>Checks school athletics sites first ({countVerifiedSchoolLogos()} sourced marks), then NBA.com / NCAA.com or ESPN. Existing selections are untouched.</span>
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
          const logo = (selected === null ? null : selected || shared) || (prefs.era === "vintage" && selected !== null ? prefs.vintageDefaults[team.key] : null) || (prefs.era === "modern" ? verifiedSchoolLogo(team.logo)?.url : null) || teamVectorFallbackLogo(team.logo) || team.logo;
          return <button type="button" key={team.league + team.key} className={active?.key === team.key && active.league === team.league ? "logo-studio-team active" : "logo-studio-team"} onClick={() => { setActive(team); setMessage(""); }}>
            <Image unoptimized src={collegeHistoricalImageSource(logo)} alt="" width={35} height={35} loading="lazy" />
            <span>{team.name}</span>
            <ChevronDown size={14} />
          </button>;
        })}</div>
        {active && <div className="logo-studio-editor">
          <div className="logo-studio-editor-heading"><strong>{active.name}</strong><span>{prefs.era === "vintage" ? "Vintage" : "Modern"} selected</span></div>
          <p className="logo-studio-note">Choose a Modern source in the first row. School website means the mark was found on that school's athletics homepage, not that reuse is licensed.</p>
          {schoolLogo && <a className="logo-studio-source-link" href={schoolLogo.sourcePage} target="_blank" rel="noopener noreferrer">View original school athletics site</a>}
          <div className="logo-studio-options logo-studio-primary" aria-label="Primary logo sources">
            {primary.map(option => <LogoOptionTile key={option.url} option={option}
              chosen={chosenForEra("modern") === option.url} onSelect={() => selectLogo(option.url, "modern")} />)}
            {Array.from({ length: Math.max(0, 3 - primary.length) }, (_, i) =>
              <div key={i} className="logo-studio-option logo-studio-unavailable"><span>Source unavailable</span></div>)}
          </div>
          <button type="button" className="logo-studio-reset" onClick={() => selectLogo(null)} aria-label="Restore automatic logo">
            <Image unoptimized src={collegeHistoricalImageSource(automatic)} width={22} height={22} alt="" />
            Restore automatic {prefs.era} logo
          </button>
          <details className="logo-studio-more">
            <summary>Other modern logos ({otherOptions.length})</summary>
            <div className="logo-studio-options">
              {otherOptions.map(option => <LogoOptionTile key={option.url} option={option}
                chosen={chosenForEra("modern") === option.url} onSelect={() => selectLogo(option.url, "modern")} />)}
            </div>
          </details>
          <details className="logo-studio-more" open={prefs.era === "vintage"}>
            <summary>Vintage logos ({history.length})</summary>
            {loadingHistory && <p className="logo-studio-note">Finding historical artwork…</p>}
            <div className="logo-studio-options">
              {history.map(option => <LogoOptionTile key={option.url}
                option={{ ...option, label: option.year ? `${option.year} · ${option.label}` : option.label }}
                chosen={chosenForEra("vintage") === option.url} onSelect={() => selectLogo(option.url, "vintage")} />)}
            </div>
            {!history.length && !loadingHistory && <p className="logo-studio-note">No additional historical logos found for this school.</p>}
          </details>
          {referenceColors.length > 0 && <details className="logo-studio-more">
            <summary>Team color reference</summary>
            <div className="logo-studio-palette" aria-label="ESPN color reference">
              <span>ESPN-listed colors (not a school brand-guide certification)</span>
              {referenceColors.map(hex => <span className="logo-studio-color" key={hex}>
                <i style={{ backgroundColor: hex }} aria-hidden="true" />{hex}
              </span>)}
            </div>
          </details>}
          <div className="logo-studio-custom">
            <input type="url" value={custom} onChange={event => setCustom(event.target.value)} placeholder="Paste PNG, SVG or WebP image URL" aria-label="Custom team logo HTTPS URL" />
            <button type="button" disabled={!validLogoUrl(custom)} onClick={() => { selectLogo(custom); setCustom(""); }}>Use logo</button>
          </div>
        </div>}
        <p className="logo-studio-note">Selections are saved to your account. Save Modern or Save Vintage publishes that collection for everyone, including after reopening the app. Game data is unaffected.</p>
    </div>
    {message && <p className="logo-studio-status" role="status">{message}</p>}
  </div>;
}
