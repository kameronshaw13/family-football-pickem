import test from "node:test";
import assert from "node:assert/strict";
import { passwordResetSchema } from "../lib/passwordReset.ts";

test("signed-in reset input accepts a new password without the forgotten password", () => {
  assert.deepEqual(passwordResetSchema.parse({ newPassword: "new-password" }), { newPassword: "new-password" });
});

test("reset body cannot supply the target account or authorization", () => {
  assert.deepEqual(passwordResetSchema.parse({ newPassword: "new-password", profileId: "someone-else", username: "other", is_admin: true }), { newPassword: "new-password" });
});

test("reset rejects empty, too short and oversized passwords", () => {
  for (const newPassword of ["", "12345", "a".repeat(129), null, 123456]) {
    assert.equal(passwordResetSchema.safeParse({ newPassword }).success, false);
  }
});
