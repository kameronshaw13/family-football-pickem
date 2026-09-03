import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, before, after, label) {
  const first = content.indexOf(before);
  if (first < 0) throw new Error(`Missing source block: ${label}`);
  if (content.indexOf(before, first + before.length) >= 0) throw new Error(`Source block is not unique: ${label}`);
  return content.slice(0, first) + after + content.slice(first + before.length);
}

const appPath = "components/PickemAppBase.tsx";
let app = read(appPath);

app = replaceOnce(
  app,
  `import { Check, ChevronDown, ChevronUp, CircleCheckBig, CircleDollarSign, FlaskConical, LoaderCircle, Send, Shield, SquareCheck, Trash2, Trophy, X, Zap } from "lucide-react";`,
  `import { Check, ChevronDown, ChevronUp, CircleCheckBig, CircleDollarSign, FlaskConical, LoaderCircle, Lock, Send, Shield, SquareCheck, Trash2, Trophy, X, Zap } from "lucide-react";`,
  "Lock icon import"
);

app = replaceOnce(
  app,
  `function isFinalGame(game: Game) {\n  return (game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed) || game.live_state === "post";\n}\n`,
  `function isFinalGame(game: Game) {\n  return (game.final_away_score != null && game.final_home_score != null) || Boolean(game.live_completed) || game.live_state === "post";\n}\nfunction universalWeekendLockTime(games: Game[]) {\n  const candidates = games.flatMap((game) => {\n    const lock = new Date(game.lock_time).getTime();\n    const kickoff = new Date(game.commence_time).getTime();\n    if (!Number.isFinite(lock) || !Number.isFinite(kickoff) || lock >= kickoff - 60_000) return [];\n    return [lock];\n  });\n  return candidates.length ? Math.min(...candidates) : null;\n}\nfunction LockedPickIndicator({ hidden = false }: { hidden?: boolean }) {\n  if (hidden) return null;\n  return <span className="pick-lock-indicator" aria-label="Locked"><Lock size={18} aria-hidden="true" /></span>;\n}\n`,
  "native universal lock helpers"
);

app = replaceOnce(
  app,
  `  const cardPicks = previewActive ? myPicks : stagedPicks ?? myPicks;\n  const cardIsLocked = tab === "card" && cardView === "mine" && cardPicks.length > 0 && cardPicks.every((pick) => {\n    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;\n    return pick.status === "locked" || Boolean(game && isClosed(game));\n  });\n  const myRegular = orderCardPicks(cardPicks.filter((p) => p.pick_type === "regular"), viewedGames, pointsMode);`,
  `  const cardPicks = previewActive ? myPicks : stagedPicks ?? myPicks;\n  const universalLockAt = universalWeekendLockTime(viewedGames);\n  const universalLockReached = universalLockAt != null && universalLockAt <= clock;\n  const requiredCardPicks = rule.regularTotal + rule.underdogTotal;\n  const allSubmittedPicksLocked = cardPicks.length > 0 && cardPicks.every((pick) => {\n    const game = viewedGames.find((item) => item.id === pick.game_id) || pick.game;\n    return pick.status === "locked" || Boolean(game && isClosed(game));\n  });\n  const cardIsFullyLocked = cardPicks.length >= requiredCardPicks && allSubmittedPicksLocked;\n  const hideCardProgress = universalLockReached || cardIsFullyLocked;\n  const myRegular = orderCardPicks(cardPicks.filter((p) => p.pick_type === "regular"), viewedGames, pointsMode);`,
  "partial-lock card progress ownership"
);

app = replaceOnce(
  app,
  `          {!cardIsLocked && <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} dirty={stagedPicks !== null} />}`,
  `          {!hideCardProgress && <CardProgress rule={rule} counts={regularCounts} hasDog={Boolean(myUnderdog)} dirty={stagedPicks !== null} />}`,
  "card progress visibility"
);

app = replaceOnce(
  app,
  `            pointsMode={pointsMode}\n            removePick={removePick}`,
  `            pointsMode={pointsMode}\n            universalLockReached={universalLockReached}\n            removePick={removePick}`,
  "PickList universal lock prop"
);

app = replaceOnce(
  app,
  `{playerPicks.map((pick) => <VisiblePick key={pick.id} pick={pick} games={viewedGames} pointsMode={pointsMode} />)}`,
  `{playerPicks.map((pick) => <VisiblePick key={pick.id} pick={pick} games={viewedGames} pointsMode={pointsMode} universalLockReached={universalLockReached} />)}`,
  "VisiblePick universal lock prop"
);

app = replaceOnce(
  app,
  `<BankWeekResults rows={bankWeekStandings} picks={bankResultPicks} games={bankResultGames} amounts={bankWeekAmounts} pointsMode={pointsMode} />`,
  `<BankWeekResults rows={bankWeekStandings} picks={bankResultPicks} games={bankResultGames} amounts={bankWeekAmounts} pointsMode={pointsMode} universalLockReached={universalLockReached} />`,
  "Weekly Results universal lock prop"
);

app = replaceOnce(
  app,
  `function BankWeekResults({ rows, picks, games, amounts, pointsMode }: { rows: Array<Standing & { rank?: number }>; picks: Pick[]; games: Game[]; amounts: Record<string, number | null>; pointsMode: boolean }) {`,
  `function BankWeekResults({ rows, picks, games, amounts, pointsMode, universalLockReached }: { rows: Array<Standing & { rank?: number }>; picks: Pick[]; games: Game[]; amounts: Record<string, number | null>; pointsMode: boolean; universalLockReached: boolean }) {`,
  "BankWeekResults signature"
);

app = replaceOnce(
  app,
  `        const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;\n        const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : pick.result === "push" ? "P" : "—";`,
  `        const displayedSpread = pick.locked_spread != null ? Number(pick.locked_spread) : game ? normalizeSpreadForSelectedTeam(pick.selected_team, game.current_spread_team, game.current_spread) : null;\n        const locked = pick.status === "locked" || Boolean(game && isClosed(game));\n        const resultLabel = pick.result === "win" ? "W" : pick.result === "loss" ? "L" : pick.result === "push" ? "P" : "—";`,
  "Weekly Results locked state"
);

app = replaceOnce(
  app,
  `          {game && hasPickScoreBug(game) ? <PickScoreBug game={game} pick={pick} spread={displayedSpread} /> : pick.result !== "pending" ? <span className={\`test-result \${pick.result}\`}>{resultLabel}</span> : <span className="test-result pending">—</span>}`,
  `          {game && hasPickScoreBug(game) ? <PickScoreBug game={game} pick={pick} spread={displayedSpread} /> : pick.result !== "pending" ? <span className={\`test-result \${pick.result}\`}>{resultLabel}</span> : locked ? <LockedPickIndicator hidden={universalLockReached} /> : null}`,
  "Weekly Results pending lock indicator"
);

app = replaceOnce(
  app,
  `function PickList({ picks, games, title, pointsMode, removePick, headerContent }: { picks: Pick[]; games: Game[]; title: string; pointsMode: boolean; removePick: (p: Pick) => void; headerContent?: React.ReactNode }) {`,
  `function PickList({ picks, games, title, pointsMode, universalLockReached, removePick, headerContent }: { picks: Pick[]; games: Game[]; title: string; pointsMode: boolean; universalLockReached: boolean; removePick: (p: Pick) => void; headerContent?: React.ReactNode }) {`,
  "PickList signature"
);

app = replaceOnce(
  app,
  `: graded ? <span className={\`badge pick-result-\${pick.result}\`}>{resultLabel}</span> : locked ? <span className="badge pick-status-locked" aria-label="Locked">—</span> : null}{!locked && <button className="icon-btn"`,
  `: graded ? <span className={\`badge pick-result-\${pick.result}\`}>{resultLabel}</span> : locked ? <LockedPickIndicator hidden={universalLockReached} /> : null}{!locked && <button className="icon-btn"`,
  "My Card native lock indicator"
);

app = replaceOnce(
  app,
  `function VisiblePick({ pick, games, pointsMode }: { pick: Pick; games: Game[]; pointsMode: boolean }) {`,
  `function VisiblePick({ pick, games, pointsMode, universalLockReached }: { pick: Pick; games: Game[]; pointsMode: boolean; universalLockReached: boolean }) {`,
  "VisiblePick signature"
);

app = replaceOnce(
  app,
  `: graded ? <span className={\`badge pick-result-\${pick.result}\`}>{resultLabel}</span> : locked ? <span className="badge pick-status-locked" aria-label="Locked">—</span> : null}</div></div>;`,
  `: graded ? <span className={\`badge pick-result-\${pick.result}\`}>{resultLabel}</span> : locked ? <LockedPickIndicator hidden={universalLockReached} /> : null}</div></div>;`,
  "League Cards native lock indicator"
);

write(appPath, app);

const enhancerPath = "components/WeekScopeAndManualLockEnhancements.tsx";
let enhancer = read(enhancerPath);
enhancer = replaceOnce(
  enhancer,
  `              confirmed.className = "manual-lock-confirmed";\n              confirmed.textContent = "Locked";\n              actions.prepend(confirmed);`,
  `              confirmed.className = "manual-lock-confirmed pick-lock-indicator";\n              confirmed.setAttribute("aria-label", "Locked");\n              confirmed.innerHTML = iconMarkup();\n              actions.prepend(confirmed);`,
  "manual lock immediate icon"
);
write(enhancerPath, enhancer);

const cssPath = "app/component-styles.css";
let css = read(cssPath);
if (!css.includes(".pick-lock-indicator")) {
  css += `\n\n/* Native pending-lock state shared by My Card, League Cards, and Weekly Results. */\n.pick-lock-indicator { display: grid; width: 30px; min-width: 30px; height: 30px; min-height: 30px; place-items: center; padding: 0; border: 0; border-radius: 0; color: var(--ink); background: transparent; box-shadow: none; line-height: 1; }\n.pick-lock-indicator svg { display: block; width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; fill: none; }\n`;
}
write(cssPath, css);

console.log("Applied native lock-state restore batch.");
