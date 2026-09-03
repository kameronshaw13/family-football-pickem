import fs from "node:fs";

await import("./fix-logo-clear-fcs-copy-v2.mjs");

const path = "tests/fcsDisplayAndMatching.test.ts";
let content = fs.readFileSync(path, "utf8");
const before = 'import { teamDisplayName } from "../lib/teamNames.ts";';
const after = 'import { teamDisplayName } from "../lib/teamNamesBase.ts";';
if (!content.includes(before)) throw new Error("Missing focused test team-name import");
content = content.replace(before, after);
fs.writeFileSync(path, content);
