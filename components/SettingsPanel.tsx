"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Images, KeyRound, LogOut, Moon, ScrollText, Sun, UserRound } from "lucide-react";
import type { Profile } from "@/lib/types";
import type { AppSlug } from "@/lib/rulePresentation";
import NumericText from "@/components/NumericText";
import PushNotificationControls from "@/components/PushNotificationControls";
import AppOpenActivity from "@/components/AppOpenActivity";
import LeagueSwitcher from "@/components/LeagueSwitcher";
import LogoStudio from "@/components/LogoStudio";
import { getLogoStudioPreferences, LOGO_STUDIO_EVENT, setLogoStudioUser, setViewerLogoEra, type LogoEra } from "@/lib/logoStudio";
import type { LeagueMembership } from "@/lib/leagueAccess";
import { clearClientSession } from "@/lib/clientSession";

type Theme = "light" | "dark";
type RuleSection = { title: string; items: string[] };

function themeKey(profileId: string) {
  return `pickem_theme:${profileId}`;
}

function applyTheme(theme: Theme, profileId: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem("pickem_theme", theme);
    window.localStorage.setItem(themeKey(profileId), theme);
  } catch {
    // The current page still updates even if browser storage is unavailable.
  }
}

export default function SettingsPanel({
  appSlug,
  currentUser,
  leagueName,
  rules,
  rulesLoading,
  loginPath,
  onCountsChanged,
  hideAcceptedBets,
  onHideAcceptedBetsChange,
  selectedLeagueSlug,
  onLeagueSelect
}: {
  appSlug: AppSlug;
  currentUser: Profile;
  leagueName?: string;
  rules: RuleSection[];
  rulesLoading: boolean;
  loginPath: string;
  onCountsChanged: (counts: Record<string, number>) => void;
  hideAcceptedBets: boolean;
  onHideAcceptedBetsChange: (hidden: boolean) => void;
  selectedLeagueSlug: AppSlug;
  onLeagueSelect: (league: LeagueMembership) => void;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [logoEra, setLogoEra] = useState<LogoEra>("modern");
  const [logoEraBusy, setLogoEraBusy] = useState(false);
  const [logoEraMessage, setLogoEraMessage] = useState("");
  const [logoStudioOpen, setLogoStudioOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordTone, setPasswordTone] = useState<"success" | "error">("success");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    setLogoStudioUser(currentUser.id, String(currentUser.username || "").trim().toLowerCase() === "kameron");
    const sync = () => setLogoEra(getLogoStudioPreferences().era);
    sync();
    window.addEventListener(LOGO_STUDIO_EVENT, sync);
    return () => window.removeEventListener(LOGO_STUDIO_EVENT, sync);
  }, [currentUser.id, currentUser.username]);

  useEffect(() => {
    const active = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(active);
  }, []);

  function chooseTheme(next: Theme) {
    setTheme(next);
    applyTheme(next, currentUser.id);
  }

  async function chooseLogoEra(next: LogoEra) {
    if (logoEraBusy || next === logoEra) return;
    setLogoEraBusy(true);
    setLogoEraMessage("");
    try { await setViewerLogoEra(next); }
    catch { setLogoEraMessage("Could not save logo style. Please retry."); }
    finally { setLogoEraBusy(false); }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setPasswordMessage("");

    if (newPassword !== confirmPassword) {
      setPasswordTone("error");
      setPasswordMessage("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordTone("error");
      setPasswordMessage("New password must be at least 6 characters.");
      return;
    }

    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) {
      window.location.replace(loginPath);
      return;
    }

    setPasswordBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-pickem-group": appSlug
        },
        body: JSON.stringify({ newPassword })
      });
      const payload = await response.json();
      if (!response.ok) {
        setPasswordTone("error");
        setPasswordMessage(payload.error || "Password could not be updated.");
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setPasswordTone("success");
      setPasswordMessage("Password updated.");
    } catch {
      setPasswordTone("error");
      setPasswordMessage("Password could not be updated.");
    } finally {
      setPasswordBusy(false);
    }
  }

  function signOut() {
    if (!window.confirm("Sign out of this Pick'em app?")) return;
    clearClientSession();
    window.location.replace(loginPath);
  }

  if (logoStudioOpen) return <section className="panel settings-panel logo-studio-page-shell" aria-label="Logo Studio page">
    <div className="section-title settings-page-title logo-studio-page-header">
      <button type="button" className="logo-studio-page-back" onClick={() => setLogoStudioOpen(false)} aria-label="Back to Settings">
        <ArrowLeft size={18} /> Settings
      </button>
      <div><h2>Logo Studio</h2><p>Customize team artwork across all leagues</p></div>
    </div>
    <LogoStudio profileId={currentUser.id} />
  </section>;

  return <section className="panel settings-panel">
    <div className="section-title settings-page-title"><div><h2>Settings</h2><p>{leagueName || "League and account preferences"}</p></div></div>

    <LeagueSwitcher activeSlug={appSlug} selectedSlug={selectedLeagueSlug} onSelect={onLeagueSelect} />

    <div className="settings-section">
      <h3>Profile</h3>
      <div className="settings-card settings-profile-card">
        <div className="settings-leading-icon"><UserRound size={17} /></div>
        <div className="settings-row-copy"><strong>{currentUser.display_name}</strong></div>
        <button
          type="button"
          className="settings-row-action player-profile-link"
          data-player-profile-name={currentUser.display_name}
        >
          View Profile <ChevronRight size={15} />
        </button>
      </div>
    </div>

    <div className="settings-section">
      <h3>Appearance</h3>
      <div className="settings-card settings-appearance-card">
        <div className="settings-row-heading">
          <div className="settings-leading-icon">{theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}</div>
          <div className="settings-row-copy"><strong>Appearance</strong><span>Choose how the app looks on this device.</span></div>
        </div>
        <div className="theme-toggle" role="group" aria-label="Appearance">
          <button type="button" className={theme === "light" ? "active" : ""} aria-pressed={theme === "light"} onClick={() => chooseTheme("light")}><Sun size={14} /> Light</button>
          <button type="button" className={theme === "dark" ? "active" : ""} aria-pressed={theme === "dark"} onClick={() => chooseTheme("dark")}><Moon size={14} /> Dark</button>
        </div>
        <div className="theme-toggle settings-logo-era-toggle" role="group" aria-label="Team logo style">
          <button type="button" className={logoEra === "modern" ? "active" : ""} aria-pressed={logoEra === "modern"} disabled={logoEraBusy} onClick={() => void chooseLogoEra("modern")}>Modern</button>
          <button type="button" className={logoEra === "vintage" ? "active" : ""} aria-pressed={logoEra === "vintage"} disabled={logoEraBusy} onClick={() => void chooseLogoEra("vintage")}>Vintage</button>
        </div>
        {logoEraMessage && <p className="logo-studio-status" role="status">{logoEraMessage}</p>}
      </div>
      {String(currentUser.username || "").trim().toLowerCase() === "kameron" && <button className="settings-card settings-logo-studio-link" type="button" onClick={() => setLogoStudioOpen(true)}>
        <span className="settings-leading-icon"><Images size={17} /></span>
        <span className="settings-row-copy"><strong>Logo Studio</strong><span>Choose modern, vintage and alternate team artwork.</span></span>
        <ChevronRight size={17} />
      </button>}
    </div>

    <div className="settings-section">
      <h3>Notifications</h3>
      <div className="settings-card settings-notification-card">
        <PushNotificationControls compactRow appSlug={appSlug} onCountsChanged={onCountsChanged} />
      </div>
    </div>

    {String(currentUser.username).toLowerCase() === "kameron" && (appSlug === "friends" || appSlug === "shaw-family" || appSlug === "friends-basketball") && <div className="settings-section">
      <h3>Private Activity</h3>
      <AppOpenActivity />
    </div>}

    <div className="settings-section">
      <h3>League</h3>
      <details className="settings-card settings-detail">
        <summary>
          <span className="settings-leading-icon"><ScrollText size={17} /></span>
          <span className="settings-row-copy"><strong>League Rules</strong><span>{leagueName || "Current league"} · Picks, scoring, locks and side bets.</span></span>
          <ChevronDown className="settings-detail-chevron" size={17} />
        </summary>
        <div className="settings-detail-body settings-rules-list">
          {rulesLoading && <p role="status">Loading league rules…</p>}
          {rules.map((section) => <details className="settings-rule-item" key={section.title}>
            <summary>{section.title}<ChevronDown size={14} /></summary>
            <ul>{section.items.map((item) => <li key={item}><NumericText text={item} /></li>)}</ul>
          </details>)}
        </div>
      </details>
    </div>

    <div className="settings-section settings-account-section">
      <h3>Account</h3>
      <details className="settings-card settings-detail settings-password-detail">
        <summary>
          <span className="settings-leading-icon"><KeyRound size={17} /></span>
          <span className="settings-row-copy"><strong>Reset Password</strong><span>Change the password used to sign in.</span></span>
          <ChevronDown className="settings-detail-chevron" size={17} />
        </summary>
        <form className="settings-detail-body settings-password-form" onSubmit={changePassword}>
          <label htmlFor="settings-new-password">New Password</label>
          <input id="settings-new-password" className="input" type="password" autoComplete="new-password" maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <label htmlFor="settings-confirm-password">Confirm New Password</label>
          <input id="settings-confirm-password" className="input" type="password" autoComplete="new-password" maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          {passwordMessage && <p className={passwordTone === "error" ? "settings-password-message error" : "settings-password-message success"} role="status">{passwordMessage}</p>}
          <button type="submit" className="btn full settings-password-submit" disabled={passwordBusy || newPassword.length < 6 || confirmPassword.length < 6}>{passwordBusy ? "Updating…" : "Update Password"}</button>
        </form>
      </details>

      <button type="button" className="settings-card settings-signout" onClick={signOut}>
        <span className="settings-leading-icon"><LogOut size={17} /></span>
        <span className="settings-row-copy"><strong>Sign Out</strong><span>Sign out on this device.</span></span>
        <ChevronRight size={17} />
      </button>
      {String(currentUser.username || "").trim().toLowerCase() === "kameron" && <button type="button" className={`settings-hide-bet-history${hideAcceptedBets ? " active" : ""}`} aria-label="Hide my side bets" aria-pressed={hideAcceptedBets} onClick={() => onHideAcceptedBetsChange(!hideAcceptedBets)}>
        {hideAcceptedBets ? "On" : "Off"}
      </button>}

    </div>
  </section>;
}
