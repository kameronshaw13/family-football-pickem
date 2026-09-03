import fs from "node:fs";

await import("./fix-logo-clear-fcs-copy-v3.mjs");

const sourcePath = "lib/espnSchedule.ts";
const testablePath = "lib/espnSchedule.testable.ts";
let scheduleSource = fs.readFileSync(sourcePath, "utf8");
const aliasImport = 'from "@/lib/espnLogos"';
if (!scheduleSource.includes(aliasImport)) throw new Error("Missing ESPN logo alias import");
scheduleSource = scheduleSource.replace(aliasImport, 'from "./espnLogos.ts"');
fs.writeFileSync(testablePath, scheduleSource);

const testPath = "tests/fcsDisplayAndMatching.test.ts";
let testSource = fs.readFileSync(testPath, "utf8");
const before = 'import { findEspnScheduleMatch } from "../lib/espnSchedule.ts";';
const after = 'import { findEspnScheduleMatch } from "../lib/espnSchedule.testable.ts";';
if (!testSource.includes(before)) throw new Error("Missing focused ESPN schedule test import");
testSource = testSource.replace(before, after);
fs.writeFileSync(testPath, testSource);
