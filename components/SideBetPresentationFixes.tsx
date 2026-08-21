"use client";

import { useEffect } from "react";

type GameLite = {
  id: string;
  league: string;
  away_team: string;
  home_team: string;
  away_logo_url?: string | null;
  home_logo_url?: string | null;
};
type AppData = { games?: GameLite[] };

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
  "utah state": "Utah St"
};

function groupSlug() {
  const path = window.location.pathname;
  if (path === "/friends" || path.startsWith("/friends/")) return "friends";
  if (path === "/caleb-family" || path.startsWith("/caleb-family/")) return "other-family";
  return "shaw-family";
}

function clean(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compactTeam(name: string) {
  const normalized = clean(name);
  if (COMPACT_NAMES[normalized]) return COMPACT_NAMES[normalized];
  if (name.length <= 12) return name;
  if (/\bState$/i.test(name)) {
    const first = name.replace(/\s+State$/i, "").trim();
    return `${first.length > 8 ? first.slice(0, 6) : first} St`;
  }
  const directions: Record<string, string> = {
    Eastern: "E.", Western: "W.", Northern: "N.", Southern: "S.", Central: "C."
  };
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 2 && directions[words[0]]) return `${directions[words[0]]} ${words[1]}`;
  if (words.length >= 2 && name.length > 16) {
    const initials = words.map((word) => word[0]?.toUpperCase() || "").join("");
    if (initials.length >= 2 && initials.length <= 5) return initials;
  }
  return name;
}

function rawMatchesDisplay(raw: string, display: string) {
  const r = clean(raw);
  const d = clean(display);
  return r === d || r.startsWith(`${d} `) || r.endsWith(` ${d}`);
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

function compactMatchup(parsed: NonNullable<ReturnType<typeof parseMatchup>>) {
  const away = compactTeam(parsed.away);
  const home = compactTeam(parsed.home);
  return parsed.creatorIsAway
    ? `${away} ${parsed.awaySpread} at ${home}`
    : `${away} at ${home} ${parsed.homeSpread}`;
}

export default function SideBetPresentationFixes() {
  useEffect(() => {
    let stopped = false;
    let games: GameLite[] = [];
    let frame = 0;

    async function loadGames() {
      const token = window.localStorage.getItem("pickem_session_token");
      if (!token) return;
      try {
        const response = await fetch("/api/app-data", {
          headers: { Authorization: `Bearer ${token}`, "x-pickem-group": groupSlug() },
          cache: "no-store"
        });
        if (!response.ok) return;
        const payload = await response.json() as AppData;
        games = payload.games || [];
        schedule();
      } catch {}
    }

    function apply() {
      if (stopped) return;
      for (const card of Array.from(document.querySelectorAll<HTMLElement>(".side-bet-card"))) {
        const label = card.querySelector<HTMLElement>(".side-bet-offer-copy > strong");
        const logo = card.querySelector<HTMLImageElement>(".side-bet-offer-row > .team-logo");
        if (!label) continue;

        label.classList.remove("side-bet-matchup-compact");
        label.removeAttribute("data-compact-matchup");
        const text = label.textContent?.replace(/\s+/g, " ").trim() || "";
        const parsed = parseMatchup(text);
        if (!parsed) continue;

        if (label.scrollWidth > label.clientWidth + 1) {
          label.setAttribute("data-compact-matchup", compactMatchup(parsed));
          label.classList.add("side-bet-matchup-compact");
        }

        if (logo && games.length) {
          const game = games.find((item) => rawMatchesDisplay(item.away_team, parsed.away) && rawMatchesDisplay(item.home_team, parsed.home));
          const expected = game ? (parsed.creatorIsAway ? game.away_logo_url : game.home_logo_url) : null;
          if (expected && logo.src !== expected) logo.src = expected;
        }
      }
    }

    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(apply);
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = () => schedule();
    window.addEventListener("resize", resize);
    void loadGames();
    schedule();

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return null;
}
