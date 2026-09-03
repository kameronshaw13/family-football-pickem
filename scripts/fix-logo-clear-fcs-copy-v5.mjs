import fs from "node:fs";

await import("./fix-logo-clear-fcs-copy-v4.mjs");

const path = "lib/espnSchedule.ts";
let content = fs.readFileSync(path, "utf8");
const beforeFunction = `function hasEmbeddedAbbreviation(sourceTokens: Set<string>, abbreviation: string) {\n  const normalizedAbbreviation = normalize(abbreviation);\n  // Two-letter abbreviations are too collision-prone (UT, OS, etc.). Longer ESPN\n  // abbreviations are safe as whole tokens and cover provider names such as\n  // "LIU Post Pioneers", "BYU Cougars", and "UCF Knights".\n  return normalizedAbbreviation.length >= 3 &&\n    !normalizedAbbreviation.includes(" ") &&\n    sourceTokens.has(normalizedAbbreviation);\n}`;
const afterFunction = `function hasEmbeddedAbbreviation(sourceName: string, abbreviation: string) {\n  const normalizedAbbreviation = normalize(abbreviation);\n  const sourceTokens = normalize(sourceName).split(" ").filter(Boolean);\n  // Two-letter abbreviations are too collision-prone. Longer ESPN abbreviations\n  // are accepted only as the provider name's leading school token. This keeps\n  // aliases such as LIU Post / BYU / UCF while preventing Northern Iowa -> Iowa.\n  return normalizedAbbreviation.length >= 3 &&\n    !normalizedAbbreviation.includes(" ") &&\n    sourceTokens[0] === normalizedAbbreviation;\n}`;
if (!content.includes(beforeFunction)) throw new Error("Missing embedded abbreviation matcher");
content = content.replace(beforeFunction, afterFunction);
const beforeCall = `  const sourceTokens = tokenSet(source);\n  if (hasEmbeddedAbbreviation(sourceTokens, team.abbreviation)) return 110;`;
const afterCall = `  const sourceTokens = tokenSet(source);\n  if (hasEmbeddedAbbreviation(source, team.abbreviation)) return 110;`;
if (!content.includes(beforeCall)) throw new Error("Missing embedded abbreviation call");
content = content.replace(beforeCall, afterCall);
fs.writeFileSync(path, content);

// Refresh the test-only copy after tightening the real matcher.
let testable = content;
const aliasImport = 'from "@/lib/espnLogos"';
if (!testable.includes(aliasImport)) throw new Error("Missing ESPN logo alias import");
testable = testable.replace(aliasImport, 'from "./espnLogos.ts"');
fs.writeFileSync("lib/espnSchedule.testable.ts", testable);
