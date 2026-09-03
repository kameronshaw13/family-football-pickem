import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceExact(content, before, after, label) {
  if (!content.includes(before)) throw new Error(`Missing source pattern: ${label}`);
  return content.replace(before, after);
}

// 1) Preload/decode the initial visible CFB board logos before revealing cached/live app data.
{
  const path = "components/PickemAppBase.tsx";
  let content = read(path);
  content = replaceExact(
    content,
    'const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;\n',
    `const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;\n\nconst INITIAL_BOARD_LOGO_GAME_LIMIT = 8;\nconst initialBoardLogoCache = new Set<string>();\n\nfunction preloadTeamLogo(url: string) {\n  if (!url || initialBoardLogoCache.has(url) || typeof window === "undefined") return Promise.resolve();\n  return new Promise<void>((resolve) => {\n    const image = new window.Image();\n    let finished = false;\n    const finish = () => {\n      if (finished) return;\n      finished = true;\n      window.clearTimeout(timeout);\n      initialBoardLogoCache.add(url);\n      resolve();\n    };\n    const decodeAndFinish = () => {\n      if (typeof image.decode !== "function") {\n        finish();\n        return;\n      }\n      void image.decode().catch(() => undefined).finally(finish);\n    };\n    const timeout = window.setTimeout(finish, 1500);\n    image.onload = decodeAndFinish;\n    image.onerror = finish;\n    image.decoding = "sync";\n    image.fetchPriority = "high";\n    image.src = url;\n    if (image.complete) decodeAndFinish();\n  });\n}\n\nasync function preloadInitialBoardLogos(payload: AppData) {\n  if (typeof window === "undefined") return;\n  const games = [...(payload.games || [])]\n    .filter((game) => game.league === "CFB" && !isFinalGame(game))\n    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())\n    .slice(0, INITIAL_BOARD_LOGO_GAME_LIMIT);\n  const urls = Array.from(new Set(games.flatMap((game) => [game.away_logo_url, game.home_logo_url]).filter((url): url is string => Boolean(url))));\n  await Promise.all(urls.map(preloadTeamLogo));\n}\n`,
    "insert initial board logo preload helper"
  );
  content = replaceExact(
    content,
    `    if (cachedPayload) {\n      const cachedAt = Date.now();`,
    `    if (cachedPayload) {\n      await preloadInitialBoardLogos(cachedPayload);\n      const cachedAt = Date.now();`,
    "preload cached initial logos"
  );
  content = replaceExact(
    content,
    `      const loadedAt = Date.now();\n      const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;\n      dataRef.current = payload;`,
    `      const loadedAt = Date.now();\n      const loadedWeekIsOpen = !payload.weekOpenTime || new Date(payload.weekOpenTime).getTime() <= loadedAt;\n      if (!cachedPayload) await preloadInitialBoardLogos(payload);\n      dataRef.current = payload;`,
    "preload first network payload logos"
  );

  // 2) Natural sentence order: You Accepted TEAM SPREAD from Caleb / You Offered TEAM SPREAD to Caleb.
  content = replaceExact(
    content,
    `      <span>{content.subject}</span>\n      <span className={\`side-bet-response \${summary.tone}\`}>{summary.action}</span>\n      {content.recipient && <span>{content.recipient}</span>}\n      {content.team && <span>{content.team}</span>}\n      <NumericText text={spread} />`,
    `      <span>{content.subject}</span>\n      <span className={\`side-bet-response \${summary.tone}\`}>{summary.action}</span>\n      {content.team && <span>{content.team}</span>}\n      <NumericText text={spread} />\n      {content.recipient && <span>{content.recipient}</span>}`,
    "side bet response sentence order"
  );
  content = replaceExact(
    content,
    `  const fullLabel = [summary.subjectFull, summary.action, summary.recipientFull, teamFull, spread, date ? \`· \${date}\` : ""].filter(Boolean).join(" ");`,
    `  const fullLabel = [summary.subjectFull, summary.action, teamFull, spread, summary.recipientFull, date ? \`· \${date}\` : ""].filter(Boolean).join(" ");`,
    "side bet response accessible label order"
  );

  // 3) One shared action-row geometry for pending, cancel, decline, accept, and Clear.
  content = replaceExact(
    content,
    `  return <article className={\`side-bet-card mode-\${mode} \${offerOpen ? "open" : ""} \${saving && !working ? "background-busy" : ""} \${canClearOffer ? "has-clear-offer-action" : ""}\`.trim()}>`,
    `  const hasActionRow = offerOpen || canClearOffer;\n\n  return <article className={\`side-bet-card mode-\${mode} \${offerOpen ? "open" : ""} \${hasActionRow ? "has-actions" : ""} \${saving && !working ? "background-busy" : ""}\`.trim()}>`,
    "shared side bet action-row class"
  );
  write(path, content);
}

// 4) Remove mascot suffixes from college display names at the shared source.
{
  const path = "lib/teamNamesBase.ts";
  let content = read(path);
  content = replaceExact(
    content,
    '  "Rainbow Warriors", "Rainbow Wahine", "Blue Raiders",',
    '  "Rainbow Warriors", "Rainbow Wahine", "Black Bears", "Blue Raiders",',
    "add Black Bears mascot"
  );
  content = replaceExact(
    content,
    '  "Jaguars", "Coyotes", "Panthers",',
    '  "Jaguars", "49ers", "Sharks", "Coyotes", "Panthers",',
    "add 49ers and Sharks mascots"
  );
  write(path, content);
}

// 5) FCS feed must match both teams. One-sided legacy matching remains available elsewhere.
{
  const path = "lib/espnSchedule.ts";
  let content = read(path);
  content = replaceExact(
    content,
    `function alignmentScore(firstTeamScore: number, secondTeamScore: number, kickoffDistance: number) {`,
    `function alignmentScore(firstTeamScore: number, secondTeamScore: number, kickoffDistance: number, allowOneSided: boolean) {`,
    "alignment score option"
  );
  content = replaceExact(
    content,
    `  if (Number.isFinite(kickoffDistance) &&\n      kickoffDistance <= ONE_SIDED_MATCH_MAX_DISTANCE_MS &&`,
    `  if (allowOneSided &&\n      Number.isFinite(kickoffDistance) &&\n      kickoffDistance <= ONE_SIDED_MATCH_MAX_DISTANCE_MS &&`,
    "guard one-sided fallback"
  );
  content = replaceExact(
    content,
    `export function findEspnScheduleMatch(matchup: Matchup, schedule: EspnScheduleGame[]): EspnScheduleMatch | null {\n  let best:`,
    `export function findEspnScheduleMatch(matchup: Matchup, schedule: EspnScheduleGame[], options: { allowOneSided?: boolean } = {}): EspnScheduleMatch | null {\n  const allowOneSided = options.allowOneSided !== false;\n  let best:`,
    "schedule match options"
  );
  content = replaceExact(
    content,
    `    const directScore = alignmentScore(directHome, directAway, distance);\n    const swappedScore = alignmentScore(swappedHome, swappedAway, distance);`,
    `    const directScore = alignmentScore(directHome, directAway, distance, allowOneSided);\n    const swappedScore = alignmentScore(swappedHome, swappedAway, distance, allowOneSided);`,
    "pass one-sided option"
  );
  write(path, content);
}

{
  const path = "app/api/cron/odds/route.ts";
  let content = read(path);
  content = replaceExact(
    content,
    `        const scheduleMatch = findEspnScheduleMatch(event, schedule);`,
    `        const scheduleMatch = findEspnScheduleMatch(event, schedule, {\n          allowOneSided: sport.key !== "americanfootball_ncaaf_fcs"\n        });`,
    "strict FCS schedule matching"
  );
  write(path, content);
}

// 6) Let all side-bet action cards grow from the same layout; remove Clear-only geometry.
{
  const path = "app/pending-side-bets.css";
  let content = read(path);
  content = content.replaceAll(".side-bet-card.open", ".side-bet-card.has-actions");
  content = content.replace("/* Pending/open Side Bet offers are the only Side Bet rows allowed to exceed the shared 62px card height. */", "/* Any Side Bet row with an action uses one shared in-flow action-row geometry. */");
  content = content.replace("/* Keep the offer summary itself on the exact same centered 48px surface as before. */", "/* Keep the offer summary on the same centered 48px surface. */");
  content = content.replace("/* Give pending actions their own centered row instead of forcing them into the 62px offer surface. */", "/* Give every action its own centered row instead of forcing it into the 62px offer surface. */");
  write(path, content);
}

{
  const path = "app/globals.css";
  let content = read(path);
  content = content.replace('.side-bet-card .clear-offer-actions { justify-content: flex-end; }\n', '');
  content = content.replace('.side-bet-card .clear-offer-actions .btn { min-height: 32px; padding: 4px 8px; }\n', '');
  write(path, content);
}

{
  const path = "app/spatial-layout.css";
  let content = read(path);
  const block = `.side-bet-card .clear-offer-actions .btn {\n  height: 32px;\n  min-height: 32px;\n  padding: 0 8px;\n}\n\n`;
  if (!content.includes(block)) throw new Error("Missing source pattern: Clear-only spatial button geometry");
  content = content.replace(block, "");
  write(path, content);
}

{
  const path = "app/component-styles.css";
  let content = read(path);
  const start = content.indexOf("/* Clear history uses the same in-flow action-row geometry as other side-bet actions.");
  const endMarker = ".side-bet-card.has-clear-offer-action > .clear-offer-actions .btn { position: relative; z-index: 3; height: 36px; min-height: 36px; padding: 0 10px; pointer-events: auto; }\n\n";
  const end = content.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error("Missing source pattern: Clear-only component styles");
  content = content.slice(0, start) + content.slice(end + endMarker.length);
  write(path, content);
}

// 7) Focused regression tests for the new FCS display/matching behavior.
write("tests/fcsDisplayAndMatching.test.ts", `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { teamDisplayName } from "../lib/teamNames.ts";\nimport { findEspnScheduleMatch } from "../lib/espnSchedule.ts";\n\nfunction scheduleGame(overrides: any = {}) {\n  return {\n    id: "game",\n    commenceTime: "2026-09-05T20:15:00.000Z",\n    timeValid: true,\n    completed: false,\n    homeScore: null,\n    awayScore: null,\n    statusDetail: null,\n    statusState: "pre",\n    possessionSide: null,\n    situationText: null,\n    redZone: false,\n    down: null,\n    distance: null,\n    yardsToGoal: null,\n    homeTimeouts: null,\n    awayTimeouts: null,\n    homeTeam: { displayName: "Iowa Hawkeyes", location: "Iowa", nickname: "Hawkeyes", abbreviation: "IOWA", logoUrl: null },\n    awayTeam: { displayName: "Eastern Washington Eagles", location: "Eastern Washington", nickname: "Eagles", abbreviation: "EWU", logoUrl: null },\n    ...overrides\n  };\n}\n\ntest("new FCS school labels omit mascots", () => {\n  assert.equal(teamDisplayName("CFB", "LIU Sharks"), "LIU");\n  assert.equal(teamDisplayName("CFB", "Maine Black Bears"), "Maine");\n  assert.equal(teamDisplayName("CFB", "Charlotte 49ers"), "Charlotte");\n});\n\ntest("strict FCS matching rejects a one-sided Northern Iowa to Iowa collision", () => {\n  const match = findEspnScheduleMatch({\n    commence_time: "2026-09-05T20:15:00.000Z",\n    home_team: "Northern Iowa Panthers",\n    away_team: "Eastern Washington Eagles"\n  }, [scheduleGame()] as any, { allowOneSided: false });\n  assert.equal(match, null);\n});\n\ntest("strict FCS matching still accepts the provider LIU Post name against ESPN LIU", () => {\n  const match = findEspnScheduleMatch({\n    commence_time: "2026-09-05T00:00:00.000Z",\n    home_team: "Kansas Jayhawks",\n    away_team: "LIU Post Pioneers"\n  }, [scheduleGame({\n    commenceTime: "2026-09-05T00:00:00.000Z",\n    homeTeam: { displayName: "Kansas Jayhawks", location: "Kansas", nickname: "Jayhawks", abbreviation: "KU", logoUrl: null },\n    awayTeam: { displayName: "LIU Sharks", location: "LIU", nickname: "Sharks", abbreviation: "LIU", logoUrl: null }\n  })] as any, { allowOneSided: false });\n  assert.ok(match);\n});\n`);
