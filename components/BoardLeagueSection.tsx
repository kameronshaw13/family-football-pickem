"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Star } from "lucide-react";

export default function BoardLeagueSection({ league, label, count, favorite = false, children }: {
  league: string;
  label: string;
  count: number;
  favorite?: boolean;
  children: ReactNode;
}) {
  // Each league expands independently. Keep the matchup rows mounted when
  // collapsed so expanding doesn't reset or reload any existing game state.
  const [expanded, setExpanded] = useState(true);

  return <section className={`game-day-group board-league-group${favorite ? " board-favorites-section" : ""}`} aria-label={label}>
    <button type="button" className="game-day-marker board-league-header"
      aria-expanded={expanded} onClick={() => setExpanded(previous => !previous)}>
      <b>{favorite ? <Star size={16} strokeWidth={2.2} fill="none" aria-hidden="true" /> : league}</b>
      <strong>{label}</strong>
      <span className="board-league-count">{count} {count === 1 ? "game" : "games"}</span>
      <ChevronDown size={17} className={`board-league-chevron${expanded ? " expanded" : ""}`} aria-hidden="true" />
    </button>
    <div className="game-list" hidden={!expanded}>{children}</div>
  </section>;
}
