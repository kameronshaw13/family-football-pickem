import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, exactWeeklySummaryRow, normalizeRelative, latestWeeklyRow, normalizePower, summarizeLocalAts, localGamesForTeam, type LocalGame } from "../lib/cfbMatchupData.ts";
import { createAsyncCache } from "../lib/asyncCache.ts";
import { ordinalDay, formatOrdinalDate, formatUppercaseOrdinalDate } from "../lib/displayDates.ts";

test("CSV preserves quoted commas, escaped quotes, multiline cells and zero values", () => {
  assert.deepEqual(parseCsv('team,note,rank\r\n"Miami, FL","a ""quote""\nnext line",0\r\n'), [
    { team: "Miami, FL", note: 'a "quote"\nnext line', rank: "0" }
  ]);
  assert.deepEqual(parseCsv("a,b\n1,2", header => header === "b"), [{ b: "2" }]);
});
test("advanced data never uses a future week and still returns an early sample", () => {
  const rows = [
    { team_id: "333.0", team: "Alabama", through_week: "4", valid_games: "4", net_adj_epa: ".2", net_adj_epa_rank: "2" },
    { team_id: "333.0", team: "Alabama", through_week: "3", valid_games: "2", net_adj_epa: ".1", net_adj_epa_rank: "5", EPAdrive_off: "1.42", EPAdrive_off_rank: "8", available_yards_pct_off: ".61", available_yards_pct_off_rank: "6", late_down_success_off: ".47", late_down_success_off_rank: "21" }
  ];
  const row = exactWeeklySummaryRow(rows, "333", "Alabama", 3);
  assert.equal(row?.through_week, "3");
  assert.equal(normalizeRelative(row)?.overallRank, 5);
  assert.equal(normalizeRelative(row)?.limitedSample, true);
  assert.equal(normalizeRelative(row)?.offense.epaPerDrive, 1.42);
  assert.equal(normalizeRelative(row)?.offense.availableYardsRate, 0.61);
  assert.equal(normalizeRelative(row)?.offense.lateDownRate, 0.47);
  assert.equal(normalizeRelative(row)?.offense.lateDownRank, 21);
  assert.equal(normalizeRelative(rows[0])?.overallRank, 2);
  assert.equal(normalizeRelative(rows[0])?.limitedSample, false);
  assert.equal(exactWeeklySummaryRow(rows, "333", "Alabama", 2), null);
});
test("FPI carries its own snapshot week rather than the advanced-data week", () => {
  const rows = [{ team_id: "333", week: "2", fpi: "20", rank: "3" }, { team_id: "333", week: "4", fpi: "30", rank: "1" }];
  const fpi = latestWeeklyRow(rows, "333", "week", 3);
  assert.equal(fpi?.week, "2");
  assert.equal(normalizePower({ through_week: "3" }, fpi)?.throughWeek, 2);
});
test("weekly summaries match the published pos_team field when a logo ID is missing", () => {
  const row = { pos_team: "Alabama", team_id: "333", through_week: "4" };
  assert.equal(exactWeeklySummaryRow([row], null, "Alabama Crimson Tide", 4), row);
});
const base: LocalGame = { id: "one", week: 3, commence_time: "2026-09-12T18:00:00Z", home_team: "Alabama Crimson Tide", away_team: "Georgia Bulldogs", current_spread_team: "Alabama Crimson Tide", current_spread: -7, final_home_score: 21, final_away_score: 14 };
test("ATS record and cover margins share the same graded games and exclude missing lines/future results", () => {
  const games = [base, { ...base, id: "missing", current_spread: null }, { ...base, id: "future", commence_time: "2026-10-01T18:00:00Z" }];
  const result = summarizeLocalAts(games, "Alabama", Date.parse("2026-09-20"), 2026);
  assert.equal(result.pushes, 1);
  assert.equal(result.wins + result.losses + result.pushes, 1);
  assert.equal(result.avgCoverMargin, 0);
  assert.equal(result.recent.length, 1);
});
test("January bowl results belong to the previous football season", () => {
  const bowl = { ...base, commence_time: "2027-01-01T18:00:00Z" };
  assert.equal(localGamesForTeam([bowl], "Alabama", Date.parse("2027-01-10"), 2026).length, 1);
});
test("cache coalesces concurrent calls, retries failures, and evicts old keys", async () => {
  const cache = createAsyncCache<number>(10000, 2);
  let calls = 0;
  const load = async () => ++calls;
  assert.deepEqual(await Promise.all([cache("a", load), cache("a", load)]), [1, 1]);
  await assert.rejects(cache("bad", async () => { throw Error("offline"); }));
  assert.equal(await cache("bad", load), 2);
  await cache("c", load);
  assert.equal(await cache("a", load), 4);
});
test("ordinal dates handle teens and the Central Time day boundary", () => {
  assert.deepEqual([1, 2, 3, 11, 12, 13, 21, 22, 23, 25, 31].map(ordinalDay), ["1st", "2nd", "3rd", "11th", "12th", "13th", "21st", "22nd", "23rd", "25th", "31st"]);
  const formatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" });
  assert.equal(formatOrdinalDate(formatter, new Date("2026-09-26T02:00:00Z")), "September 25th");
  assert.equal(formatUppercaseOrdinalDate(formatter, new Date("2026-09-24T18:00:00Z")), "SEPTEMBER 24th");
});
