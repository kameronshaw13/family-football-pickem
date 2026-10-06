import assert from "node:assert/strict";
import test from "node:test";
import { notificationMoney, notificationStakeText } from "../lib/notificationMoney.ts";

test("notificationMoney always includes a dollar sign", () => {
  assert.equal(notificationMoney(40), "$40");
  assert.equal(notificationMoney(36.36), "$36.36");
  assert.equal(notificationMoney(12.5), "$12.50");
});

test("notificationStakeText formats even and non-even odds cleanly", () => {
  assert.equal(notificationStakeText(30, 30), "$30");
  assert.equal(notificationStakeText(36.36, 40), "Risk $36.36 to win $40");
});
