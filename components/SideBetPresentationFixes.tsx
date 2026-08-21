"use client";

import { useEffect } from "react";

const SPREAD_RE = /(Pick'em|[+-]\d+(?:\.\d+)?)/i;
const COMPACT_NAMES: Record<string, string> = {
  "eastern michigan": "EMU",
  "western michigan": "WMU",
  "central michigan": "CMU",
  "northern illinois": "NIU",
  "sacramento state": "Sac State",
  "north carolina": "UNC",
  "north carolina state": "NC State",
  "appalachian state": "App State",
  "san jose state": "SJSU",
  "fresno state": "Fresno St",
  "boise state": "Boise St",
  "colorado state": "Colorado St",
  "utah state": "Utah St",
  "florida state": "Florida St",
  "michigan state": "Michigan St",
  "ohio state": "Ohio St",
  "penn state": "Penn St",
  "oklahoma state": "Oklahoma St",
  "kansas state": "Kansas St",
  "iowa state": "Iowa St",
  "arizona state": "Arizona St",
  "oregon state": "Oregon St",
  "washington state": "Washington St"
};

function clean(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compactTeam(name: string) {
  const normalized = clean(name);
  if (COMPACT_NAMES[normalized]) return COMPACT_NAMES[normalized];
  if (name.length <= 10 || /^[A-Z0-9]{2,7}$/.test(name)) return name;

  if (/\bState$/i.test(name)) return name.replace(/\s+State$/i, " St");
  if (/\bUniversity$/i.test(name)) return name.replace(/\s+University$/i, "");

  const words = name.split(/\s+/).filter(Boolean);
  const directions: Record<string, string> = {
    Eastern: "E.", Western: "W.", Northern: "N.", Southern: "S.", Central: "C."
  };
  if (words.length >= 2 && directions[words[0]]) return `${directions[words[0]]} ${words.slice(1).join(" ")}`;

  if (words.length >= 2) {
    const initials = words.map((word) => word[0]?.toUpperCase() || "").join("");
    if (initials.length >= 2 && initials.length <= 5) return initials;
  }
  return name;
}

function parseMatchup(text: string) {
  const parts = text.split(/\s+at\s+/i);
  if (parts.length !== 2) return null;
  const awayPart = parts[0].trim();
  const homePart = parts[1].trim();
  const awaySpread = awayPart.match(SPREAD_RE)?.[0] || "";
  const homeSpread = homePart.match(SPREAD_RE)?.[0] || "";
  const away = awayPart.replace(SPREAD_RE, "").trim();
  const home = homePart.replace(SPREAD_RE, "").trim();
  if (!away || !home || (!awaySpread && !homeSpread)) return null;
  return { away, home, awaySpread, homeSpread, creatorIsAway: Boolean(awaySpread) };
}

function matchup(parsed: NonNullable<ReturnType<typeof parseMatchup>>, away: string, home: string) {
  return parsed.creatorIsAway
    ? `${away} ${parsed.awaySpread} at ${home}`
    : `${away} at ${home} ${parsed.homeSpread}`;
}

function measuredWidth(text: string, element: HTMLElement) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Number.POSITIVE_INFINITY;
  const style = window.getComputedStyle(element);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return context.measureText(text).width;
}

export default function SideBetPresentationFixes() {
  useEffect(() => {
    let stopped = false;
    let frame = 0;

    function apply() {
      if (stopped) return;
      document.querySelectorAll<HTMLElement>(".side-bet-card .side-bet-offer-copy > strong").forEach((label) => {
        label.classList.remove("side-bet-matchup-compact");
        label.removeAttribute("data-compact-matchup");

        const full = label.textContent?.replace(/\s+/g, " ").trim() || "";
        const parsed = parseMatchup(full);
        if (!parsed || label.clientWidth <= 0) return;
        if (measuredWidth(full, label) <= label.clientWidth - 1) return;

        const awayCompact = compactTeam(parsed.away);
        const homeCompact = compactTeam(parsed.home);
        const awaySavings = parsed.away.length - awayCompact.length;
        const homeSavings = parsed.home.length - homeCompact.length;

        const oneSide = awaySavings >= homeSavings
          ? matchup(parsed, awayCompact, parsed.home)
          : matchup(parsed, parsed.away, homeCompact);
        const bothSides = matchup(parsed, awayCompact, homeCompact);
        const chosen = measuredWidth(oneSide, label) <= label.clientWidth - 1 ? oneSide : bothSides;

        label.setAttribute("data-compact-matchup", chosen);
        label.classList.add("side-bet-matchup-compact");
      });
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    schedule();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return null;
}
