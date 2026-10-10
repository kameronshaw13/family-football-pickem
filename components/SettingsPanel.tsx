"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronRight, KeyRound, LogOut, Moon, ScrollText, Sun, UserRound } from "lucide-react";
import type { Profile } from "@/lib/types";
import type { AppSlug } from "@/lib/rulePresentation";
import NumericText from "@/components/NumericText";
import ArcSegmentedControl from "@/components/arc/segmented-control/segmented-control";
import PushNotificationControls from "@/components/PushNotificationControls";
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
  loginPath,
  onCountsChanged
}: {
  appSlug: AppSlug;
  currentUser: Profile;
  leagueName?: string;
  rules: RuleSection[];
  loginPath: string;
  onCountsChanged: (counts: Record<string, number>) => void;
}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordTone, setPasswordTone] = useState<"success" | "error">("success");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    const active = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(active);
  }, []);

  function chooseTheme(next: Theme) {
    setTheme(next);
    applyTheme(next, currentUser.id);
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
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const payload = await response.json();
      if (!response.ok) {
        setPasswordTone("error");
        setPasswordMessage(payload.error || "Password could not be updated.");
        return;
      }

      setCurrentPassword("");
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

  return <section className="panel settings-panel">
    <div className="section-title settings-page-title"><div><h2>Settings</h2><p>{leagueName || "League and account preferences"}</p></div></div>

    <div className="settings-section">
      <h3>Profile</h3>
      <div className="settings-card settings-profile-card">
        <div className="arc-profile-avatar" aria-hidden="true">{currentUser.display_name.trim().split(/\\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || <UserRound size={17} />}</div>
        <div className="settings-row-copy"><strong>{currentUser.display_name}</strong><span>@{currentUser.username}</span></div>
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
        <div className="arc-appearance-toggle">
          <ArcSegmentedControl
            label="Appearance"
            value={theme}
            onValueChange={(value) => chooseTheme(value === "dark" ? "dark" : "light")}
            options={[
              { value: "light", label: "Light", accessory: <Sun size={14} aria-hidden="true" /> },
              { value: "dark", label: "Dark", accessory: <Moon size={14} aria-hidden="true" /> }
            ]}
          />
        </div>
      </div>
    </div>

    <div className="settings-section">
      <h3>Notifications</h3>
      <div className="settings-card settings-notification-card">
        <div className="settings-row-heading settings-notification-heading">
          <div className="settings-leading-icon"><Bell size={17} /></div>
          <div className="settings-row-copy"><strong>Push Notifications</strong><span>Offers, results, picks and league activity.</span></div>
        </div>
        <PushNotificationControls appSlug={appSlug} onCountsChanged={onCountsChanged} />
      </div>
    </div>

    <div className="settings-section">
      <h3>League</h3>
      <details className="settings-card settings-detail">
        <summary>
          <span className="settings-leading-icon"><ScrollText size={17} /></span>
          <span className="settings-row-copy"><strong>League Rules</strong><span>Scoring, picks, dogs, locks and Side Bets.</span></span>
          <ChevronDown className="settings-detail-chevron" size={17} />
        </summary>
        <div className="settings-detail-body settings-rules-list">
          {rules.map((section) => <details className="settings-rule-item" key={section.title}>
            <summary>{section.title}<ChevronDown size={14} /></summary>
            <ul>{section.items.map((item) => <li key={item}><NumericText text={item} /></li>)}</ul>
          </details>)}
        </div>
      </details>
    </div>

    <div className="settings-section">
      <h3>Account</h3>
      <details className="settings-card settings-detail settings-password-detail">
        <summary>
          <span className="settings-leading-icon"><KeyRound size={17} /></span>
          <span className="settings-row-copy"><strong>Reset Password</strong><span>Change the password used to sign in.</span></span>
          <ChevronDown className="settings-detail-chevron" size={17} />
        </summary>
        <form className="settings-detail-body settings-password-form" onSubmit={changePassword}>
          <label htmlFor="settings-current-password">Current Password</label>
          <input id="settings-current-password" className="input" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <label htmlFor="settings-new-password">New Password</label>
          <input id="settings-new-password" className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <label htmlFor="settings-confirm-password">Confirm New Password</label>
          <input id="settings-confirm-password" className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          {passwordMessage && <p className={passwordTone === "error" ? "settings-password-message error" : "settings-password-message success"} role="status">{passwordMessage}</p>}
          <button type="submit" className="btn accent full settings-password-submit" disabled={passwordBusy || currentPassword.length < 6 || newPassword.length < 6 || confirmPassword.length < 6}>{passwordBusy ? "Updating…" : "Update Password"}</button>
        </form>
      </details>

      <button type="button" className="settings-card settings-signout" onClick={signOut}>
        <span className="settings-leading-icon"><LogOut size={17} /></span>
        <span className="settings-row-copy"><strong>Sign Out</strong><span>Sign out on this device.</span></span>
        <ChevronRight size={17} />
      </button>
    </div>
  </section>;
}
