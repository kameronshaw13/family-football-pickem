import fs from "node:fs";

await import("./fix-logo-clear-fcs-copy-v2.mjs");

const path = "tests/fcsDisplayAndMatching.test.ts";
fs.writeFileSync(path, `import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nimport { teamDisplayName } from "../lib/teamNamesBase.ts";\n\ntest("new FCS school labels omit mascots", () => {\n  assert.equal(teamDisplayName("CFB", "LIU Sharks"), "LIU");\n  assert.equal(teamDisplayName("CFB", "Maine Black Bears"), "Maine");\n  assert.equal(teamDisplayName("CFB", "Charlotte 49ers"), "Charlotte");\n});\n\ntest("FCS odds feed disables one-sided ESPN schedule matching", () => {\n  const matcher = fs.readFileSync("lib/espnSchedule.ts", "utf8");\n  const oddsRoute = fs.readFileSync("app/api/cron/odds/route.ts", "utf8");\n  assert.match(matcher, /allowOneSided/);\n  assert.match(matcher, /if \(allowOneSided &&/);\n  assert.match(oddsRoute, /allowOneSided: sport\.key !== "americanfootball_ncaaf_fcs"/);\n});\n`);
