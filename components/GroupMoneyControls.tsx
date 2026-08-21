"use client";

import { useEffect, useState } from "react";
import NumericText from "@/components/NumericText";

type Props = {
  week: number;
  weeklyAmount: number;
  seasonAmount: number;
  weeklySubmitted: boolean;
  seasonSubmitted: boolean;
  canEdit: boolean;
  onSaved: (weeklyAmount: number, seasonAmount: number, weeklySubmitted: boolean, seasonSubmitted: boolean) => void;
  onError?: (message: string) => void;
};

function displayMoney(value: number) {
  const absolute = Math.abs(Number(value) || 0);
  return `$${absolute.toFixed(Number.isInteger(absolute) ? 0 : 2)}`;
}

export default function GroupMoneyControls({ week, weeklyAmount, seasonAmount, weeklySubmitted, seasonSubmitted, canEdit, onSaved, onError }: Props) {
  const [weekly, setWeekly] = useState(String(weeklyAmount || 0));
  const [season, setSeason] = useState(String(seasonAmount || 0));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setWeekly(String(weeklyAmount || 0)), [week, weeklyAmount]);
  useEffect(() => setSeason(String(seasonAmount || 0)), [seasonAmount]);

  function fail(text: string) {
    setMessage(text);
    onError?.(text);
  }

  async function save() {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    const nextWeekly = Number(weekly);
    const nextSeason = week === 1 && !seasonSubmitted ? Number(season) : null;
    if (!Number.isFinite(nextWeekly) || nextWeekly <= 0 || (nextSeason != null && (!Number.isFinite(nextSeason) || nextSeason <= 0))) {
      fail("Each required pot must be greater than $0.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/group-money", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ week, weeklyAmount: nextWeekly, ...(nextSeason == null ? {} : { seasonAmount: nextSeason }) })
      });
      const payload = await response.json();
      if (!response.ok) {
        fail(payload.error || "Could not save the money settings.");
        return;
      }
      setWeekly(String(payload.weeklyAmount));
      setSeason(String(payload.seasonAmount));
      setMessage("Pot submitted.");
      onSaved(Number(payload.weeklyAmount), Number(payload.seasonAmount), Boolean(payload.weeklySubmitted), Boolean(payload.seasonSubmitted));
    } catch {
      fail("Could not save the money settings.");
    } finally {
      setSaving(false);
    }
  }

  if (weeklySubmitted) return <section className="group-money-summary">
    <div className="group-money-grid single">
      <div className="group-money-field"><span>Week {week} pot</span><strong><NumericText text={displayMoney(weeklyAmount)} /></strong></div>
    </div>
  </section>;

  const showSeasonEntry = week === 1 && !seasonSubmitted;
  const nextWeekly = Number(weekly);
  const nextSeason = Number(season);
  const validAmounts = Number.isFinite(nextWeekly) && nextWeekly > 0 && (!showSeasonEntry || Number.isFinite(nextSeason) && nextSeason > 0);

  return <section className="group-money-controls">
    <div className={`group-money-grid${showSeasonEntry ? "" : " single"}`}>
      <div className="group-money-field">
        {canEdit ? <>
          <label htmlFor="weekly-wta">Week {week} pot</label>
          <div className="group-money-input-wrap"><span>$</span><input id="weekly-wta" inputMode="decimal" type="number" min="0.01" step="1" value={weekly} onChange={(event) => setWeekly(event.target.value)} /></div>
        </> : <>
          <span>Week {week} pot</span><strong><NumericText text={displayMoney(weeklyAmount)} /></strong>
        </>}
      </div>
      {showSeasonEntry && <div className="group-money-field">
        {canEdit ? <>
          <label htmlFor="season-wta">Season pot</label>
          <div className="group-money-input-wrap"><span>$</span><input id="season-wta" inputMode="decimal" type="number" min="0.01" step="1" value={season} onChange={(event) => setSeason(event.target.value)} /></div>
        </> : <>
          <span>Season pot</span><strong><NumericText text={displayMoney(seasonAmount)} /></strong>
        </>}
      </div>}
    </div>
    {message && <p className={message === "Pot submitted." ? "group-money-message success" : "group-money-message error"}>{message}</p>}
    {canEdit && <div className="group-money-save"><button type="button" className="btn accent" disabled={saving || !validAmounts} onClick={() => void save()}>{saving ? "Submitting…" : `Submit Week ${week} pot${showSeasonEntry ? " & season pot" : ""}`}</button></div>}
  </section>;
}
