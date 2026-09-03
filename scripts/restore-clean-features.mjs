import fs from "node:fs";
import { execFileSync } from "node:child_process";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function fromCommit(sha, path) {
  return execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8" });
}

function replaceOnce(content, before, after, label) {
  const first = content.indexOf(before);
  if (first < 0) throw new Error(`Missing source block: ${label}`);
  if (content.indexOf(before, first + before.length) >= 0) throw new Error(`Source block is not unique: ${label}`);
  return content.slice(0, first) + after + content.slice(first + before.length);
}

// Restore isolated data/features from their known-good commits. These files were
// not part of the later UI/performance patch stack.
write("lib/espnSchedule.ts", fromCommit("fb65cfb99ab33034257bccdc6169d5dc54b413e5", "lib/espnSchedule.ts"));
write("app/api/cron/odds/route.ts", fromCommit("63cbfd42133a01a07bcaed0eca17511b9fae0e29", "app/api/cron/odds/route.ts"));
write("lib/sideBetPresentation.ts", fromCommit("10f5e5da2076b33a8f1b7f1e6d76bfbdd97bd341", "lib/sideBetPresentation.ts"));

// Restore the reviewed, user-selected college abbreviations, then retain the
// later preference to spell out State in full display names.
let teamNames = fromCommit("c52965f9662fbc67bb24558b019d3229dedcbcb0", "lib/teamNames.ts");
teamNames = replaceOnce(
  teamNames,
  `};\n\nexport function teamDisplayName(league: string | null | undefined, team: string) {\n  if (league !== "NFL") {\n    const override = DISPLAY_OVERRIDES[normalizeTeamNameKey(team)];\n    if (override) return override;\n  }\n  return baseTeamDisplayName(league, team);\n}\n`,
  `};\n\nfunction restoreStateDisplay(team: string, displayName: string) {\n  if (!/\\bstate\\b/i.test(team)) return displayName;\n  return displayName.replace(/\\bSt\\.(?=\\s|$)/g, "State");\n}\n\nexport function teamDisplayName(league: string | null | undefined, team: string) {\n  if (league !== "NFL") {\n    const override = DISPLAY_OVERRIDES[normalizeTeamNameKey(team)];\n    if (override) return override;\n  }\n  const displayName = baseTeamDisplayName(league, team);\n  return league === "NFL" ? displayName : restoreStateDisplay(team, displayName);\n}\n`,
  "college State display"
);
write("lib/teamNames.ts", teamNames);

// Fix the client to use the group side-bet rule already returned by app-data.
// null means unlimited. The API remains the authoritative validator.
const appPath = "components/PickemAppBase.tsx";
let app = read(appPath);
app = replaceOnce(
  app,
  `import { MAX_SIDE_BETS_PER_WEEK, MAX_SIDE_BET_AMOUNT, hasAvailableSideBetSlot } from "@/lib/sideBetLimits";`,
  `import { MAX_SIDE_BET_AMOUNT, hasAvailableSideBetSlot } from "@/lib/sideBetLimits";`,
  "remove hardcoded weekly side-bet import"
);
app = replaceOnce(
  app,
  `    if ((data?.sideBetSlotCounts?.[currentUser.id] || 0) >= MAX_SIDE_BETS_PER_WEEK) {\n      notify(\`You already have \${MAX_SIDE_BETS_PER_WEEK} accepted or pending side bets this week.\`, "error");\n      return false;\n    }\n    const fullRecipient = profiles.find((profile) => betRecipients.includes(profile.id) && (data?.sideBetSlotCounts?.[profile.id] || 0) >= MAX_SIDE_BETS_PER_WEEK);\n`,
  `    const maxPerWeek = data.sideBetSettings?.maxPerWeek ?? null;\n    if (maxPerWeek != null && (data.sideBetSlotCounts?.[currentUser.id] || 0) >= maxPerWeek) {\n      notify(\`You already have \${maxPerWeek} accepted or pending side bets this week.\`, "error");\n      return false;\n    }\n    const fullRecipient = maxPerWeek == null ? undefined : profiles.find((profile) => betRecipients.includes(profile.id) && (data.sideBetSlotCounts?.[profile.id] || 0) >= maxPerWeek);\n`,
  "create-side-bet group limit"
);
app = replaceOnce(
  app,
  `          slotCounts={data.sideBetSlotCounts || {}}\n          weekIsOpen={weekIsOpen}`,
  `          slotCounts={data.sideBetSlotCounts || {}}\n          maxPerWeek={data.sideBetSettings?.maxPerWeek ?? null}\n          weekIsOpen={weekIsOpen}`,
  "pass group side-bet limit"
);
app = replaceOnce(
  app,
  `function SideBetCenter({ view, setView, currentUser, profiles, sideBets, slotCounts, weekIsOpen, openGames, gameLeague, gameConference, selectedGame, selectedCreatorTeam, amount, recipients, saving, savingBetId, offerNotificationCount, setGame, setGameLeague, setGameConference, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {\n  view: BetView;\n  setView: (value: BetView) => void;\n  currentUser: Profile;\n  profiles: Profile[];\n  sideBets: SideBet[];\n  slotCounts: Record<string, number>;\n  weekIsOpen: boolean;`,
  `function SideBetCenter({ view, setView, currentUser, profiles, sideBets, slotCounts, maxPerWeek, weekIsOpen, openGames, gameLeague, gameConference, selectedGame, selectedCreatorTeam, amount, recipients, saving, savingBetId, offerNotificationCount, setGame, setGameLeague, setGameConference, setCreatorTeam, setAmount, toggleRecipient, createBet, respond }: {\n  view: BetView;\n  setView: (value: BetView) => void;\n  currentUser: Profile;\n  profiles: Profile[];\n  sideBets: SideBet[];\n  slotCounts: Record<string, number>;\n  maxPerWeek: number | null;\n  weekIsOpen: boolean;`,
  "SideBetCenter maxPerWeek prop"
);
app = replaceOnce(
  app,
  `  const slotCount = slotCounts[currentUser.id] || 0;\n  const limitReached = slotCount >= MAX_SIDE_BETS_PER_WEEK;`,
  `  const slotCount = slotCounts[currentUser.id] || 0;\n  const weeklyLimit = maxPerWeek == null ? Infinity : maxPerWeek;\n  const limitReached = Number.isFinite(weeklyLimit) && slotCount >= weeklyLimit;`,
  "SideBetCenter group limit state"
);
app = replaceOnce(
  app,
  `      {limitReached && <div className="empty-state side-bet-empty-state"><NumericText text={\`Your \${MAX_SIDE_BETS_PER_WEEK} side bet slots are accepted or pending this week.\`} /></div>}`,
  `      {limitReached && <div className="empty-state side-bet-empty-state"><NumericText text={\`Your \${weeklyLimit} side bet slots are accepted or pending this week.\`} /></div>}`,
  "side-bet limit message"
);
app = replaceOnce(
  app,
  `            const recipientFull = (slotCounts[profile.id] || 0) >= MAX_SIDE_BETS_PER_WEEK;`,
  `            const recipientFull = Number.isFinite(weeklyLimit) && (slotCounts[profile.id] || 0) >= weeklyLimit;`,
  "recipient limit state"
);
app = replaceOnce(
  app,
  `    {view === "offers" && <SideBetList bets={offers} currentUser={currentUser} empty="No side bet offers yet." saving={saving} savingBetId={savingBetId} canAccept={(bet) => weekIsOpen && hasAvailableSideBetSlot(sideBets, currentUser.id, bet.week, MAX_SIDE_BETS_PER_WEEK, bet.id)} acceptDisabledText={!weekIsOpen ? "Opens Tue 8:00 AM" : "Limit reached"} requestAccept={setConfirmingBetId} respond={respond} />}`,
  `    {view === "offers" && <SideBetList bets={offers} currentUser={currentUser} empty="No side bet offers yet." saving={saving} savingBetId={savingBetId} canAccept={(bet) => weekIsOpen && hasAvailableSideBetSlot(sideBets, currentUser.id, bet.week, weeklyLimit, bet.id)} acceptDisabledText={!weekIsOpen ? "Opens Tue 8:00 AM" : "Limit reached"} requestAccept={setConfirmingBetId} respond={respond} />}`,
  "accept group limit"
);
write(appPath, app);

console.log("Applied clean feature restore batch.");
