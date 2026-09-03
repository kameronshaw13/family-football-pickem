import test from "node:test";
import assert from "node:assert/strict";
import { hasAvailableSideBetSlot, sideBetSlotCounts } from "../lib/sideBetLimits.ts";

test("the offer being reviewed does not block its recipient's final slot", () => {
  const rows = [
    { id: "prior-week", week: 1, creator_id: "sender-0", accepted_by: "recipient", status: "settled" },
    { id: "accepted-1", week: 2, creator_id: "sender-1", accepted_by: "recipient", status: "accepted" },
    { id: "accepted-2", week: 2, creator_id: "sender-2", accepted_by: "recipient", status: "accepted" },
    { id: "pending-3", week: 2, creator_id: "sender-3", accepted_by: null, status: "open", targets: [{ recipient_id: "recipient", response: "pending" }] }
  ];

  assert.equal(sideBetSlotCounts(rows.filter((row) => row.week === 2), ["recipient"]).recipient, 3);
  assert.equal(hasAvailableSideBetSlot(rows, "recipient", 2, 3, "pending-3"), true);
});
