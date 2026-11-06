import { test } from "node:test";
import assert from "node:assert/strict";
import { annualEventSchema, eventsDuring } from "../../src/lib/planning.ts";

test("annual events validate type, dates and text without imposing training time rules", () => {
  const input = { title: "Høstferie", kind: "holiday", startDate: "2026-10-01", endDate: "2026-10-09", description: "" };
  assert.deepEqual(annualEventSchema.parse(input), input);
  assert.equal(annualEventSchema.safeParse({ ...input, endDate: input.startDate }).success, true);
  assert.equal(annualEventSchema.safeParse({ ...input, endDate: "2027-01-02" }).success, true);
  for (const patch of [
    { endDate: "2026-09-30" }, { endDate: "2026-02-30" }, { kind: "training" }, { title: "" },
    { startDate: "1999-12-31" }, { endDate: "2101-01-01" }, { description: "x".repeat(8001) },
  ]) assert.equal(annualEventSchema.safeParse({ ...input, ...patch }).success, false);
});

test("inclusive event overlap covers days, month boundaries, year transitions and leap day", () => {
  const events = [
    { id: "cup", startDate: "2026-11-01", endDate: "2026-11-01" },
    { id: "holiday", startDate: "2026-12-20", endDate: "2027-01-04" },
    { id: "leap", startDate: "2028-02-29", endDate: "2028-03-01" },
  ];
  assert.deepEqual(eventsDuring(events, "2026-11-01").map((event) => event.id), ["cup"]);
  assert.deepEqual(eventsDuring(events, "2026-11-02"), []);
  assert.deepEqual(eventsDuring(events, "2027-01-01", "2027-01-31").map((event) => event.id), ["holiday"]);
  assert.deepEqual(eventsDuring(events, "2027-01-04").map((event) => event.id), ["holiday"]);
  assert.deepEqual(eventsDuring(events, "2027-01-05"), []);
  assert.deepEqual(eventsDuring(events, "2028-02-01", "2028-02-29").map((event) => event.id), ["leap"]);
});
