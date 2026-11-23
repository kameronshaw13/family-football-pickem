import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("all sports use one matchup card shell in Picks and Side Bets", () => {
  const frame = read("components/MatchupCardFrame.tsx");
  const picks = read("components/PickemPickViews.tsx");
  const bets = read("components/PickemSideBetViews.tsx");
  assert.match(frame, /game-card matchup-card/);
  assert.match(picks, /<MatchupCardFrame className=/);
  assert.match(bets, /<MatchupCardFrame className=/);
  assert.match(picks, /disabled=\{!awaySelectable\}/);
  assert.match(bets, /disabled=\{disabled\}/);
});

test("matchup surface and popup tokens are defined once in foundations", () => {
  const foundations = read("app/ui-foundations.css");
  const details = read("app/ui-details.css");
  for (const token of [
    "--matchup-header-surface", "--matchup-team-surface",
    "--matchup-divider", "--matchup-section-divider",
    "--detail-header-height", "--detail-header-surface",
    "--detail-header-ink", "--notification-surface"
  ]) {
    assert.ok(foundations.includes(token + ":"), token + " missing from foundations");
    assert.ok(details.includes(token), token + " unused in detail styling");
  }
  assert.match(details, /--matchup-header-surface: var\(--canvas\)/);
  assert.match(details, /--matchup-team-surface: #fff/);
  assert.match(details, /\.picks-panel \.game-card:not\(\.locked-out\)/);
});

test("fixed bottom navigation and round count badges retain their geometry", () => {
  const foundations = read("app/ui-foundations.css");
  assert.match(foundations, /\.primary-nav \{[^}]*position: fixed !important/);
  assert.match(foundations, /\.notification-badge \{[^}]*border-radius: var\(--ui-radius-circle\)/);
  assert.match(foundations, /\.notification-badge-value \{[^}]*place-items: center/);
});

test("GameTracker and Player Profile close buttons share an actual component", () => {
  const profiles = read("components/PlayerProfiles.tsx");
  const tracker = read("components/GameTracker.tsx");
  assert.match(profiles, /<GameDetailClose\b/);
  assert.match(tracker, /<GameDetailClose\b/);
});
