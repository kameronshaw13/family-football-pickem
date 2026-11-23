import test from "node:test";
import assert from "node:assert/strict";
import {
  sideBetOffersRequest, sideBetLedgerRequest, sideBetMutationRequest, sideBetRequestHeaders
} from "../lib/sideBetNetwork.ts";

test("offers use a week-scoped no-store request with league authorization", () => {
  const { url, init } = sideBetOffersRequest(8, "secret", "friends");
  assert.equal(url, "/api/side-bets?week=8");
  assert.equal(init.cache, "no-store");
  assert.deepEqual(init.headers, { Authorization: "Bearer secret", "x-pickem-group": "friends" });
});

test("ledger uses the same source of auth and group headers", () => {
  const { url, init } = sideBetLedgerRequest(2, "session", "friends-basketball");
  assert.equal(url, "/api/side-bet-ledger?week=2");
  assert.equal(init.cache, "no-store");
  assert.deepEqual(init.headers, sideBetRequestHeaders("session", "friends-basketball"));
});

test("mutations preserve POST JSON contents, selected week and group isolation", () => {
  const body = { action: "accept", sideBetId: "offer-7", visibleLiveHomeScore: 18 };
  const { url, init } = sideBetMutationRequest(body, 3, "key", "shaw-family");
  assert.equal(url, "/api/side-bets");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer key",
    "x-pickem-group": "shaw-family"
  });
  assert.deepEqual(JSON.parse(init.body), { ...body, viewWeek: 3 });
  assert.deepEqual(body, { action: "accept", sideBetId: "offer-7", visibleLiveHomeScore: 18 });
});

test("unknown week remains optional and no current user data leaks into another request", () => {
  const { init } = sideBetMutationRequest({ action: "create" }, null, "token", "other-family");
  assert.deepEqual(JSON.parse(init.body), { action: "create", viewWeek: null });
  assert.equal((init.headers as Record<string, string>)["x-pickem-group"], "other-family");
});
