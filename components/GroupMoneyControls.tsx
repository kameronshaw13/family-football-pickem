"use client";

import { useEffect, useState } from "react";
import NumericText from "@/components/NumericText";

type Props = {
  week: number;
  weeklyAmount: number;
  seasonAmount: number;
  canEdit: boolean;
  managerName: string | null;
  onSaved: (weeklyAmount: number, seasonAmount: number) => void;
  onError: (message: string) => void;
};

function displayMoney(value: number) {
  const absolute = Math.abs(Number(value) || 0);
  return `$${absolute.toFixed(Number.isInteger(absolute) ? 0 : 2)}`;
}

export default function GroupMoneyControls({ week, weeklyAmount, seasonAmount, canEdit, managerName, onSaved, onError }: Props) {
  const [weekly, setWeekly] = useState(String(weeklyAmount || 0));
  const [season, setSeason] = useState(String(seasonAmount || 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => setWeekly(String(weeklyAmount || 0)), [week, weeklyAmount]);
  useEffect(() => setSeason(String(seasonAmount || 0)), [seasonAmount]);

  async function save() {
    const token = window.localStorage.getItem("pickem_session_token");
    if (!token) return;
    const nextWeekly = Number(weekly);
    const nextSeason = Number(season);
    if (!Number.isFinite(nextWeekly) || nextWeekly < 0 || !Number.isFinite(nextSeason) || nextSeason < 0) {
      onError("Enter valid winner-take-all dollar amounts.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/group-money", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ week, weeklyAmount: nextWeekly, seasonAmount: nextSeason })
      });
      const payload = await response.json();
      if (!response.ok) {
        onError(payload.error || "Could not save the money settings.");
        return;
      }
      setWeekly(String(payload.weeklyAmount));
      setSeason(String(payload.seasonAmount));
      onSaved(Number(payload.weeklyAmount), Number(payload.seasonAmount));
    } catch {
      onError("Could not save the money settings.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="group-money-controls">
    <div className="group-money-controls-head"><strong>Winner Take All</strong><small>{canEdit ? `Set the Week ${week} pot and the season pot.` : `${managerName || "Caleb"} sets these amounts.`}</small></div>
    <div className="group-money-grid">
      <div className="group-money-field">
        {canEdit ? <><label htmlFor="weekly-wta">Week {week} pot</label><div className="group-money-input-wrap"><span>$</span><input id="weekly-wta" inputMode="decimal" type="number" min="0" step="1" value={weekly} onChange={(event) => setWeekly(event.target.value)} /></div></> : <><span>Week {week} pot</span><strong><NumericText text={displayMoney(weeklyAmount)} /></strong></>}
      </div>
      <div className="group-money-field">
        {canEdit ? <><label htmlFor="season-wta">Season pot</label><div className="group-money-input-wrap"><span>$</span><input id="season-wta" inputMode="decimal" type="number" min="0" step="1" value={season} onChange={(event) => setSeason(event.target.value)} /></div></> : <><span>Season pot</span><strong><NumericText text={displayMoney(seasonAmount)} /></strong></>}
      </div>
    </div>
    {canEdit && <div className="group-money-save"><button type="button" className="btn accent" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save amounts"}</button></div>}
  </section>;
}
