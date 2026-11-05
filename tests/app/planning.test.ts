import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualPlanSchema, checkSessionPlan, dateSchema, datesInYear, emptySessionPlan, eventSchema, nffAgeSource,
  osloToday, periodSchema, sessionPlanSchema, sourceUrlSchema, weekdayFor,
} from "../../src/lib/planning.ts";
import { completePlan } from "./planning-fixtures.ts";
import { formatTimeRange, timeRangeSchema } from "../../src/lib/validation.ts";

test("from/to times determine duration, including boundaries and midnight, never submitted duration", () => {
  const input = { date: "2026-11-04", startTime: "17:00", endTime: "18:15", durationMinutes: 999, title: "Økt", theme: "", objectives: "" };
  assert.equal(eventSchema.parse(input).durationMinutes, 75);
  assert.equal(eventSchema.parse({ ...input, endTime: "18:30" }).durationMinutes, 90);
  assert.equal(eventSchema.parse({ ...input, startTime: "23:00", endTime: "00:15" }).durationMinutes, 75);
  assert.equal(formatTimeRange("23:00", "00:15"), "23:00–00:15 (neste dag)");
  for (const endTime of ["17:00", "17:14", "21:01", "16:59", "24:00", ""]) {
    assert.equal(timeRangeSchema.safeParse({ startTime: "17:00", endTime }).success, false, endTime);
  }
  for (const endTime of ["17:15", "21:00"]) {
    assert.equal(timeRangeSchema.safeParse({ startTime: "17:00", endTime }).success, true);
  }
  assert.equal(eventSchema.safeParse({ ...input, endTime: undefined }).success, false);
});

test("calendar dates use real ISO dates, Oslo today, leap years and stable local weekdays", () => {
  assert.equal(datesInYear(2028).length, 366);
  assert.equal(datesInYear(2027).length, 365);
  assert.equal(dateSchema.safeParse("2027-02-29").success, false);
  assert.equal(dateSchema.safeParse("2028-02-29").success, true);
  assert.equal(dateSchema.safeParse("2026-13-01").success, false);
  assert.equal(dateSchema.safeParse("2026-11-31").success, false);
  assert.equal(dateSchema.safeParse("1999-12-31").success, false);
  assert.equal(weekdayFor("2026-03-29"), 7);
  assert.equal(weekdayFor("2026-10-25"), 7);
  assert.equal(osloToday(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assert.equal(osloToday(new Date("2026-06-01T22:30:00Z")), "2026-06-02");
});

test("annual plans calculate NFF age sources per year without generating themes", () => {
  assert.equal(nffAgeSource(2026, 2017).age, 9);
  assert.ok(nffAgeSource(2026, 2017).url.endsWith("/barn_8-9/"));
  assert.ok(nffAgeSource(2027, 2017).url.endsWith("/barn_10-11/"));
  assert.ok(nffAgeSource(2029, 2017).url.endsWith("/barn_12/"));
  assert.ok(nffAgeSource(2030, 2017).url.endsWith("/ungdom_13-16/"));
  assert.equal(nffAgeSource(2026, null).age, null);
  assert.equal(annualPlanSchema.safeParse({ year: 2026, birthYear: 2025, objectives: "" }).success, false);
  assert.equal(annualPlanSchema.parse({ year: "2026", birthYear: "", objectives: "" }).birthYear, null);
});

test("period boundaries, times and source URLs are validated", () => {
  const period = { startDate: "2026-01-01", endDate: "2026-02-28", theme: "Tema", objectives: "Mål", progression: "", sourceUrl: "" };
  assert.equal(periodSchema.safeParse(period).success, true);
  assert.equal(periodSchema.safeParse({ ...period, endDate: "2025-12-31" }).success, false);
  assert.equal(periodSchema.safeParse({ ...period, endDate: "2027-01-01" }).success, false);
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://user:password@example.invalid"]) {
    assert.equal(sourceUrlSchema.safeParse(url).success, false);
  }
  assert.equal(sourceUrlSchema.safeParse("https://tiim.no/ovelse/3-og-3-pasninger").success, true);
  assert.equal(eventSchema.safeParse({ date: "2026-01-01", startTime: "24:00", durationMinutes: 60, title: "Test", theme: "", objectives: "" }).success, false);
});

test("drafts preserve unknown equipment and never produce success-shaped resource checks", () => {
  const draft = sessionPlanSchema.parse(emptySessionPlan());
  assert.equal(draft.availableBalls, null);
  const check = checkSessionPlan(draft, 60);
  assert.deepEqual(check.peak, { balls: null, smallGoals: null, largeGoals: null, coaches: null });
  assert.ok(check.warnings.some((warning) => warning.includes("ukjent")));
  assert.ok(check.warnings.some((warning) => warning.includes("bekreftet")));
  assert.ok(check.warnings.some((warning) => warning.includes("0 minutter")));
  assert.ok(check.warnings.length > 0);
});

test("session checks measure exact time, all concurrent groups, reserves and peak requirements", () => {
  const plan = completePlan();
  assert.equal(checkSessionPlan(plan, 60).warnings.length, 0);
  assert.equal(checkSessionPlan(plan, 59).warnings.some((warning) => warning.includes("60 minutter")), true);
  plan.exercises.push({ ...plan.exercises[0], id: "00000000-0000-4000-8000-000000000002", durationMinutes: 10, balls: 3, reserveBalls: 1 });
  assert.equal(checkSessionPlan(plan, 70).peak.balls, 5, "sequential blocks use peak, not sum");
  plan.exercises[0].balls = 5;
  assert.ok(checkSessionPlan(plan, 70).warnings.some((warning) => warning.includes("trenger 6, tilgjengelig 5")));
  plan.exercises[0].assignedPlayers = 6;
  assert.ok(checkSessionPlan(plan, 70).warnings.some((warning) => warning.includes("spillerfordelingen")));
  plan.exercises[0].balls = null;
  assert.equal(checkSessionPlan(plan, 70).peak.balls, null, "partial resource counts never appear as an exact peak");
  assert.ok(checkSessionPlan(plan, 70).warnings.some((warning) => warning.includes("samlet utstyrsbehov")));
  plan.exercises[0].coaches = 3;
  assert.ok(checkSessionPlan(plan, 70).warnings.some((warning) => warning.includes("Trenere: trenger 3")));
});

test("plan contract requires unique exercise IDs and safe checked-source metadata", () => {
  const plan = completePlan();
  plan.exercises.push(plan.exercises[0]);
  assert.equal(sessionPlanSchema.safeParse(plan).success, false);
  plan.exercises.pop();
  plan.exercises[0].sourceUrl = "https://tiim.no/ovelse/3-og-3-pasninger";
  assert.ok(checkSessionPlan(plan, 60).warnings.some((warning) => warning.includes("kontrolldato")));
  plan.exercises[0].sourceAge = "8–9";
  plan.exercises[0].sourceCheckedOn = "2026-11-05";
  assert.equal(checkSessionPlan(plan, 60).warnings.length, 0);
});
