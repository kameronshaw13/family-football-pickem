import fs from "node:fs";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceExact(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing source pattern: ${label}`);
  return content.replace(before, after);
}

// Initial board: decode only the first visible CFB logos before the app reveals data.
{
  const path = "components/PickemAppBase.tsx";
  let content = read(path);
  content = replaceExact(content,
    'const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;\n',
    `const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;\n\nconst INITIAL_BOARD_LOGO_GAME_LIMIT = 8;\nconst initialBoardLogoCache = new Set<string>();\n\nfunction preloadTeamLogo(url: string) {\n  if (!url || initialBoardLogoCache.has(url) || typeof window === "undefined") return Promise.resolve();\n  return new Promise<void>((resolve) => {\n    const image = new window.Image();\n    let finished = false;\n    const finish = () => {\n      if (finished) return;\n      finished = true;\n      window.clearTimeout(timeout);\n      initialBoardLogoCache.add(url);\n      resolve();\n    };\n    const decodeAndFinish = () => {\n      if (typeof image.decode !== "function") { finish(); return; }\n      void image.decode().catch(() => undefined).finally(finish);\n    };\n    const timeout = window.setTimeout(finish, 1500);\n    image.onload = decodeAndFinish;\n    image.onerror = finish;\n    image.decoding = "sync";\n    image.fetchPriority = "high";\n    image.src = url;\n    if (image.complete) decodeAndFinish();\n  });\n}\n\nasync function preloadInitialBoardLogos(payload: AppData) {\n  if (typeof window === "undefined") return;\n  const games = [...(payload.games || [])]\n    .filter((game) => game.league === "CFB" && !isFinalGame(game))\n    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())\n    .slice(0, INITIAL_BOARD_LOGO_GAME_LIMIT);\n  const urls = Array.from(new Set(games.flatMap((game) => [game.away_logo_url, game.home_logo_url]).filter((url): url is string => Boolean(url))));\n  await Promise.all(urls.map(preloadTeamLogo));\n}\n`,
    "initial logo preload helper");
  content = replaceExact(content,
    `    if (cachedPayload) {\n      const cachedAt = Date.now();`,
    `    if (cachedPayload) {\n      await preloadInitialBoardLogos(cachedPayload);\n      const cachedAt = Date.now();`,
    "cached logo preload");
  content = replaceExact(content,
    `      const loadedAt = Date.now();\n      const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;\n      dataRef.current = payload;`,
    `      const loadedAt = Date.now();\n      const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;\n      if (!cachedPayload) await preloadInitialBoardLogos(payload);\n      dataRef.current = payload;`,
    "network logo preload");

  // Natural sentence order: You Accepted TEAM SPREAD from Caleb / You Offered TEAM SPREAD to Caleb.
  content = replaceExact(content,
    `      <span>{content.subject}</span>\n      <span className={\`side-bet-response \${summary.tone}\`}>{summary.action}</span>\n      {content.recipient && <span>{content.recipient}</span>}\n      {content.team && <span>{content.team}</span>}\n      <NumericText text={spread} />`,
    `      <span>{content.subject}</span>\n      <span className={\`side-bet-response \${summary.tone}\`}>{summary.action}</span>\n      {content.team && <span>{content.team}</span>}\n      <NumericText text={spread} />\n      {content.recipient && <span>{content.recipient}</span>}`,
    "side bet sentence order");
  content = replaceExact(content,
    `  const fullLabel = [summary.subjectFull, summary.action, summary.recipientFull, teamFull, spread, date ? \`· \${date}\` : ""].filter(Boolean).join(" ");`,
    `  const fullLabel = [summary.subjectFull, summary.action, teamFull, spread, summary.recipientFull, date ? \`· \${date}\` : ""].filter(Boolean).join(" ");`,
    "side bet accessible label order");

  // All side-bet cards with actions share one action-row layout.
  content = replaceExact(content,
    `  return <article className={\`side-bet-card mode-\${mode} \${offerOpen ? "open" : ""} \${saving && !working ? "background-busy" : ""} \${canClearOffer ? "has-clear-offer-action" : ""}\`.trim()}>`,
    `  const hasActionRow = offerOpen || canClearOffer;\n\n  return <article className={\`side-bet-card mode-\${mode} \${offerOpen ? "open" : ""} \${hasActionRow ? "has-actions" : ""} \${saving && !working ? "background-busy" : ""}\`.trim()}>`,
    "shared action class");
  write(path, content);
}

// College display names: school only, including newly imported FCS names.
{
  const path = "lib/teamNamesBase.ts";
  let content = read(path);
  content = replaceExact(content,
    '  "Rainbow Warriors", "Rainbow Wahine", "Blue Raiders",',
    '  "Rainbow Warriors", "Rainbow Wahine", "Black Bears", "49ers", "Sharks", "Blue Raiders",',
    "FCS mascot suffixes");
  write(path, content);
}

// FCS odds feed: require both teams to identify. Preserve one-sided legacy matching elsewhere.
{
  const path = "lib/espnSchedule.ts";
  let content = read(path);
  content = replaceExact(content,
    `function alignmentScore(firstTeamScore: number, secondTeamScore: number, kickoffDistance: number) {`,
    `function alignmentScore(firstTeamScore: number, secondTeamScore: number, kickoffDistance: number, allowOneSided: boolean) {`,
    "alignment option");
  content = replaceExact(content,
    `  if (Number.isFinite(kickoffDistance) &&\n      kickoffDistance <= ONE_SIDED_MATCH_MAX_DISTANCE_MS &&`,
    `  if (allowOneSided &&\n      Number.isFinite(kickoffDistance) &&\n      kickoffDistance <= ONE_SIDED_MATCH_MAX_DISTANCE_MS &&`,
    "one-sided guard");
  content = replaceExact(content,
    `export function findEspnScheduleMatch(matchup: Matchup, schedule: EspnScheduleGame[]): EspnScheduleMatch | null {\n  let best:`,
    `export function findEspnScheduleMatch(matchup: Matchup, schedule: EspnScheduleGame[], options: { allowOneSided?: boolean } = {}): EspnScheduleMatch | null {\n  const allowOneSided = options.allowOneSided !== false;\n  let best:`,
    "match options");
  content = replaceExact(content,
    `    const directScore = alignmentScore(directHome, directAway, distance);\n    const swappedScore = alignmentScore(swappedHome, swappedAway, distance);`,
    `    const directScore = alignmentScore(directHome, directAway, distance, allowOneSided);\n    const swappedScore = alignmentScore(swappedHome, swappedAway, distance, allowOneSided);`,
    "pass match option");
  write(path, content);
}

{
  const path = "app/api/cron/odds/route.ts";
  let content = read(path);
  content = replaceExact(content,
    `        const scheduleMatch = findEspnScheduleMatch(event, schedule);`,
    `        const scheduleMatch = findEspnScheduleMatch(event, schedule, {\n          allowOneSided: sport.key !== "americanfootball_ncaaf_fcs"\n        });`,
    "strict FCS feed matching");
  write(path, content);
}

// Shared action-row layout. Clear no longer owns its own height/alignment rules.
{
  const path = "app/pending-side-bets.css";
  let content = read(path);
  if (!content.includes(".side-bet-card.open")) throw new Error("Missing source pattern: pending side-bet action geometry");
  content = content.replaceAll(".side-bet-card.open", ".side-bet-card.has-actions");
  content = content.replace("/* Pending/open Side Bet offers are the only Side Bet rows allowed to exceed the shared 62px card height. */", "/* Any Side Bet row with an action uses one shared in-flow action-row geometry. */");
  content = content.replace("/* Keep the offer summary itself on the exact same centered 48px surface as before. */", "/* Keep the offer summary on the same centered 48px surface. */");
  content = content.replace("/* Give pending actions their own centered row instead of forcing them into the 62px offer surface. */", "/* Give every action its own centered row instead of forcing it into the 62px offer surface. */");
  write(path, content);
}

{
  const path = "app/globals.css";
  let content = read(path);
  content = replaceExact(content, '.side-bet-card .clear-offer-actions { justify-content: flex-end; }\n', '', "Clear right alignment");
  content = replaceExact(content, '.side-bet-card .clear-offer-actions .btn { min-height: 32px; padding: 4px 8px; }\n', '', "Clear 32px geometry");
  write(path, content);
}

{
  const path = "app/spatial-layout.css";
  let content = read(path);
  content = replaceExact(content,
    `.side-bet-card .clear-offer-actions .btn {\n  height: 32px;\n  min-height: 32px;\n  padding: 0 8px;\n}\n\n`,
    "",
    "Clear spatial geometry");
  write(path, content);
}

{
  const path = "app/component-styles.css";
  let content = read(path);
  const start = content.indexOf("/* Clear history uses the same in-flow action-row geometry as other side-bet actions.");
  const endMarker = ".side-bet-card.has-clear-offer-action > .clear-offer-actions .btn { position: relative; z-index: 3; height: 36px; min-height: 36px; padding: 0 10px; pointer-events: auto; }\n\n";
  const end = content.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error("Missing source pattern: Clear-only component layout");
  content = content.slice(0, start) + content.slice(end + endMarker.length);
  write(path, content);
}

write("tests/fcsDisplayAndMatching.test.ts", `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { teamDisplayName } from "../lib/teamNames.ts";\nimport { findEspnScheduleMatch } from "../lib/espnSchedule.ts";\n\nfunction scheduleGame(overrides: any = {}) {\n  return {\n    id: "game", commenceTime: "2026-09-05T20:15:00.000Z", timeValid: true, completed: false,\n    homeScore: null, awayScore: null, statusDetail: null, statusState: "pre", possessionSide: null,\n    situationText: null, redZone: false, down: null, distance: null, yardsToGoal: null, homeTimeouts: null, awayTimeouts: null,\n    homeTeam: { displayName: "Iowa Hawkeyes", location: "Iowa", nickname: "Hawkeyes", abbreviation: "IOWA", logoUrl: null },\n    awayTeam: { displayName: "Eastern Washington Eagles", location: "Eastern Washington", nickname: "Eagles", abbreviation: "EWU", logoUrl: null },\n    ...overrides\n  };\n}\n\ntest("new FCS school labels omit mascots", () => {\n  assert.equal(teamDisplayName("CFB", "LIU Sharks"), "LIU");\n  assert.equal(teamDisplayName("CFB", "Maine Black Bears"), "Maine");\n  assert.equal(teamDisplayName("CFB", "Charlotte 49ers"), "Charlotte");\n});\n\ntest("strict FCS matching rejects a one-sided Northern Iowa to Iowa collision", () => {\n  const match = findEspnScheduleMatch({ commence_time: "2026-09-05T20:15:00.000Z", home_team: "Northern Iowa Panthers", away_team: "Eastern Washington Eagles" }, [scheduleGame()] as any, { allowOneSided: false });\n  assert.equal(match, null);\n});\n\ntest("strict FCS matching still accepts provider LIU Post against ESPN LIU", () => {\n  const match = findEspnScheduleMatch({ commence_time: "2026-09-05T00:00:00.000Z", home_team: "Kansas Jayhawks", away_team: "LIU Post Pioneers" }, [scheduleGame({\n    commenceTime: "2026-09-05T00:00:00.000Z",\n    homeTeam: { displayName: "Kansas Jayhawks", location: "Kansas", nickname: "Jayhawks", abbreviation: "KU", logoUrl: null },\n    awayTeam: { displayName: "LIU Sharks", location: "LIU", nickname: "Sharks", abbreviation: "LIU", logoUrl: null }\n  })] as any, { allowOneSided: false });\n  assert.ok(match);\n});\n`);
