"use client";

import { useEffect } from "react";

const ACTIONS = new Set(["Accepted", "Cancelled", "Closed", "Declined", "Expired", "Offered"]);
const BATCH1_STYLES = `
.rule-item summary{min-height:50px;padding-top:4px;padding-bottom:4px}
.rule-item[open] .rule-copy{padding-top:5px}
.notification-badge{min-width:17px;height:17px;padding:0 4px;font-size:8.5px;line-height:1}
.notification-badge>.numeric-token{display:grid;width:100%;height:100%;place-items:center;transform:none;line-height:1}
.notification-badge .numeric-fragment{display:block;line-height:1}
.nav-notification-badge{top:-6px;right:-9px;min-width:17px;height:17px;padding:0 4px;border:0;box-shadow:0 0 0 2px var(--graphite)}
.game-final-status{text-transform:none}
.game-card.final-outcome .team-row.outcome-loss .team-name,.game-card.final-outcome .team-row.outcome-loss .team-board-market,.game-card.final-outcome .team-row.outcome-loss .team-result-score{color:var(--muted);-webkit-text-fill-color:var(--muted)}
.game-card.final-outcome .team-row.outcome-loss .team-logo,.score-bug-team.outcome-loss .team-logo{opacity:1;filter:none}
.score-bug-team.outcome-loss .score-bug-score{color:var(--muted)}
.side-bet-response-line[data-batch1-text] .side-bet-response-value{visibility:hidden}
.side-bet-response-line[data-batch1-text]::after{position:absolute;inset:0 auto auto 0;max-width:100%;overflow:hidden;color:var(--muted);content:attr(data-batch1-text);text-overflow:ellipsis;white-space:nowrap;visibility:visible}
`;

function condensedTime(value: string) {
  return value.replace(/^(\w{3})\s+(\d{1,2}):00\s+(AM|PM)$/i, "$1 $2 $3");
}

function dayOnly(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
function textWidth(text: string, style: CSSStyleDeclaration) {
  const context = canvas?.getContext("2d");
  if (!context) return Number.POSITIVE_INFINITY;
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

function parseMeasure(measure: HTMLElement) {
  const parts = Array.from(measure.children)
    .map((child) => child.textContent?.replace(/\s+/g, " ").trim() || "")
    .filter(Boolean);
  const actionIndex = parts.findIndex((part) => ACTIONS.has(part));
  if (actionIndex < 0) return null;
  const dateIndex = parts.findIndex((part) => /^·\s/.test(part));
  const date = dateIndex >= 0 ? parts[dateIndex].replace(/^·\s*/, "") : "";
  const spreadIndex = dateIndex >= 0 ? dateIndex - 1 : parts.length - 1;
  const spread = parts[spreadIndex] || "";
  const teamIndex = spreadIndex - 1;
  const team = parts[teamIndex] || "";
  const recipient = teamIndex > actionIndex + 1 ? parts.slice(actionIndex + 1, teamIndex).join(" ") : "";
  return { subject: parts.slice(0, actionIndex).join(" "), action: parts[actionIndex], recipient, team, spread, date };
}

function applyCompactSideBetLine(line: HTMLElement) {
  const measures = Array.from(line.querySelectorAll<HTMLElement>(".side-bet-response-measure"));
  if (measures.length < 3) return;
  const teamMeasure = parseMeasure(measures[2]);
  const fullTeamMeasure = parseMeasure(measures[1]);
  if (!teamMeasure || teamMeasure.action !== "Offered" || teamMeasure.subject !== "You" || !teamMeasure.recipient || !teamMeasure.team || !teamMeasure.spread) {
    line.removeAttribute("data-batch1-text");
    return;
  }

  const fullTeam = fullTeamMeasure?.team || teamMeasure.team;
  const fullTime = teamMeasure.date;
  const shortTime = condensedTime(fullTime);
  const day = dayOnly(fullTime);
  const baseWith = (team: string) => `Offered ${teamMeasure.recipient} • ${team} ${teamMeasure.spread}`;
  const candidates = [
    fullTime ? `${baseWith(fullTeam)} • ${fullTime}` : baseWith(fullTeam),
    fullTime ? `${baseWith(teamMeasure.team)} • ${fullTime}` : baseWith(teamMeasure.team),
    shortTime ? `${baseWith(teamMeasure.team)} • ${shortTime}` : "",
    day ? `${baseWith(teamMeasure.team)} • ${day}` : "",
    baseWith(teamMeasure.team)
  ].filter(Boolean);

  const value = line.querySelector<HTMLElement>(".side-bet-response-value");
  if (!value) return;
  const style = window.getComputedStyle(value);
  const available = Math.max(0, line.clientWidth - 1);
  const selected = candidates.find((candidate) => textWidth(candidate, style) <= available) || candidates[candidates.length - 1];
  line.dataset.batch1Text = selected;
}

export default function Batch1UiEnhancements() {
  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      document.querySelectorAll<HTMLElement>(".side-bet-response-line").forEach(applyCompactSideBetLine);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule).catch(() => undefined);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return <style>{BATCH1_STYLES}</style>;
}
