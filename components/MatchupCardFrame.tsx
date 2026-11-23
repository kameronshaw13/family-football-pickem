import type { ReactNode } from "react";

/**
 * Shared outer frame for football/basketball Pick Board and Side Bet matchups.
 * Keeps a single DOM structure and styling hook for all four sports while
 * leaving the different pick, offer and preview interactions to each view.
 */
export default function MatchupCardFrame({
  className = "",
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return <article className={`game-card matchup-card ${className}`.trim()}>{children}</article>;
}
