import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionHasEnded, sessionReviewSchema } from "../../src/lib/session-review.ts";

const exerciseId = "00000000-0000-4000-8000-000000000001";

test("review requires at least one rating or nonblank comment and accepts zero", () => {
  const exercise = { exerciseId, rating: null, comment: "" };
  assert.equal(sessionReviewSchema.safeParse({ comment: " ", exercises: [exercise] }).success, false);
  assert.equal(sessionReviewSchema.safeParse({ comment: "Generelt", exercises: [] }).success, true);
  assert.equal(sessionReviewSchema.safeParse({ comment: "", exercises: [{ ...exercise, rating: 0 }] }).success, true);
  assert.equal(sessionReviewSchema.safeParse({ comment: "", exercises: [{ ...exercise, comment: "Bra" }] }).success, true);
  assert.equal(sessionReviewSchema.safeParse({ comment: "", exercises: [{ ...exercise, rating: 6 }] }).success, false);
  assert.equal(sessionReviewSchema.safeParse({ comment: "Generelt", exercises: [exercise, exercise] }).success, false);
});

test("reviews open only after the Oslo end time, including overnight training", () => {
  const event = { date: "2026-11-09", startTime: "18:00", endTime: "19:00" };
  assert.equal(sessionHasEnded(event, new Date("2026-11-09T17:59:00Z")), false);
  assert.equal(sessionHasEnded(event, new Date("2026-11-09T18:00:00Z")), true);
  const overnight = { date: "2026-11-09", startTime: "23:30", endTime: "00:30" };
  assert.equal(sessionHasEnded(overnight, new Date("2026-11-09T22:45:00Z")), false);
  assert.equal(sessionHasEnded(overnight, new Date("2026-11-09T23:30:00Z")), true);
});