import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annualPlanSchema, checkSessionPlan, coachSelectionChanged, dateSchema, datesInYear, emptySessionPlan, eventSchema, nffAgeSource,
  generationDate, osloToday, periodSchema, sessionPlanSchema, sessionSections, sourceUrlSchema, weekdayFor,
  skillProgression, objectivesForSkill, parseSkillObjectives, selectedMomentIndices, annualThemeSuggestions, themePeriodContent, skillForSession, planningThemeDrop,
} from "../../src/lib/planning.ts";
import { completePlan } from "./planning-fixtures.ts";
import { birthYearSchema, formatTimeRange, settingsSchema, timeRangeSchema } from "../../src/lib/validation.ts";
import { defaultPlanningPriorities, planningPrioritiesSchema } from "../../src/lib/planning-priorities.ts";
import { differentiationCounts, differentiationSchema } from "../../src/lib/differentiation.ts";

test("differentiation slider divides the total and clamps boundaries", () => {
  assert.deepEqual(differentiationCounts([5, 11], 22), [5, 6, 11]);
  assert.deepEqual(differentiationCounts([5, 11], 8), [5, 3, 0]);
  assert.deepEqual(differentiationCounts([5, 11], 0), [0, 0, 0]);
  assert.deepEqual(differentiationCounts([4, 4], 10), [4, 0, 6]);
});

test("differentiation validates levels without requiring group counts", () => {
  const settings = differentiationSchema.parse({ enabled: true, levels: [
    { players: 4, groups: 1 }, { players: 6, groups: 0 }, { players: 12, groups: 3 },
  ] });
  assert.equal(differentiationSchema.safeParse({ ...settings, levels: settings.levels.map((level) => ({ ...level, groups: 0 })) }).success, true);
  assert.equal(differentiationSchema.safeParse({ ...settings, levels: [{ players: -1, groups: 1 }, ...settings.levels.slice(1)] }).success, false);
});

test("exercise recalculation tracks changed coach selections independent of order", () => {
  const first = crypto.randomUUID(), second = crypto.randomUUID();
  const plan = { ...completePlan(), coachIds: [first, second], coachIdsForExercises: [second, first] };
  assert.equal(coachSelectionChanged(plan), false);
  assert.equal(coachSelectionChanged({ ...plan, coachIds: [first] }), true);
  assert.equal(coachSelectionChanged({ ...plan, coachIds: [] }), true);
  assert.equal(coachSelectionChanged({ ...plan, coachIds: [first], exercises: [] }), false);
  assert.equal(coachSelectionChanged({ ...plan, coachIdsForExercises: undefined }), false);
});

test("AI priorities preserve a complete user order and reject duplicates, omissions and unknown sources", () => {
  const reversed = [...defaultPlanningPriorities].reverse();
  assert.deepEqual(planningPrioritiesSchema.parse(reversed), reversed);
  assert.equal(planningPrioritiesSchema.safeParse(defaultPlanningPriorities.slice(1)).success, false);
  assert.equal(planningPrioritiesSchema.safeParse(Array(6).fill("coach_input")).success, false);
  assert.equal(planningPrioritiesSchema.safeParse([...defaultPlanningPriorities.slice(1), "unknown"]).success, false);
  assert.deepEqual(settingsSchema.parse({ generationDaysBefore: 3, aiPriorities: reversed }).aiPriorities, reversed);
  assert.equal(settingsSchema.parse({ generationDaysBefore: 3 }).aiPriorities, undefined);
});

test("planning drops require a known theme payload and valid target month", () => {
  assert.deepEqual(planningThemeDrop({ topicId: "nff-1", theme: "Pasning" }, { month: 2 }), { topicId: "nff-1", month: 2 });
  assert.equal(planningThemeDrop(undefined, { month: 2 }), null);
  assert.equal(planningThemeDrop({ topicId: "nff-1", theme: "Pasning" }, undefined), null);
  assert.equal(planningThemeDrop({ topicId: "", theme: "Pasning" }, { month: 2 }), null);
  assert.equal(planningThemeDrop({ topicId: "nff-1", theme: "Pasning" }, { month: 13 }), null);
});

test("moment selection handles missing curriculum and preserves locked or edited choices", () => {
  assert.deepEqual(selectedMomentIndices(undefined, null), []);
  const skill = { id: "pasning", moments: ["Se opp", "Støtt", "Bli spillbar"] };
  assert.deepEqual(selectedMomentIndices(skill, null), [0, 1]);
  assert.deepEqual(selectedMomentIndices(skill, null, ["Bli spillbar"]), [2]);
  assert.deepEqual(selectedMomentIndices(skill, { id: "pasning", indices: [] }), []);
  assert.deepEqual(selectedMomentIndices(skill, { id: "medtak", indices: [2] }), [0, 1]);
});

test("session subskill suggestions follow coach order and two or three session blocks", () => {
  const skills = [{ title: "Medtak" }, { title: "Pasning" }];
  const progression = skillProgression([{ title: "Pasning", sessions: 2 }, { title: "Medtak", sessions: 3 }]);
  assert.deepEqual(Array.from({ length: 6 }, (_, index) => skillForSession(skills, index, progression)?.title),
    ["Pasning", "Pasning", "Medtak", "Medtak", "Medtak", "Pasning"]);
  assert.equal(skillForSession(skills, 3)?.title, "Pasning");
  assert.equal(skillForSession([], 0), undefined);
});

test("changing main theme regenerates goals, subskills and source together", () => {
  const attack = { theme: "Spille fremover", moments: ["Bli spillbar"], sourceUrl: "https://tiim.no/artikkel/angrep", skills: [{ title: "Pasning" }] };
  const defence = { theme: "Hindre mål", moments: ["Steng skuddrom"], sourceUrl: "https://tiim.no/artikkel/forsvar", skills: [{ title: "Press" }] };
  assert.match(themePeriodContent(attack).progression, /Pasning: 3 økter/);
  const updated = themePeriodContent(defence);
  assert.equal(updated.theme, "Hindre mål");
  assert.equal(updated.objectives, "Steng skuddrom");
  assert.equal(updated.sourceUrl, defence.sourceUrl);
  assert.match(updated.progression, /Press: 3 økter/);
  assert.doesNotMatch(updated.progression, /Pasning/);
  assert.deepEqual(attack.moments, ["Bli spillbar"]);
});

test("annual suggestions form long periods, fill only empty months and never mutate saved plans", () => {
  const themes = ["Spille fremover", "Score mål", "Vinne ball", "Hindre mål"].map((theme, index) => ({
    id: String(index), kind: "main", theme, moments: ["Se opp"], sourceUrl: "https://tiim.no/artikkel/fagplan", skills: [{ title: "Pasning" }],
  }));
  const empty = annualThemeSuggestions(2028, [], themes);
  assert.equal(empty.length, 6);
  assert.equal(empty[0].startDate, "2028-01-01");
  assert.equal(empty[0].endDate, "2028-02-29");
  assert.equal(empty[5].endDate, "2028-12-31");
  const period = { ...empty[0], id: "saved", startDate: "2028-02-10", endDate: "2028-02-20", theme: "Trenerens tema" };
  const snapshot = structuredClone(period);
  const suggestions = annualThemeSuggestions(2028, [period], themes);
  assert.ok(suggestions.every((suggestion) => suggestion.endDate < period.startDate || suggestion.startDate > period.endDate));
  assert.equal(suggestions[0].endDate, "2028-01-31");
  assert.equal(suggestions[1].startDate, "2028-03-01");
  assert.deepEqual(period, snapshot);
  assert.deepEqual(annualThemeSuggestions(2028, [], []), []);
  assert.deepEqual(annualThemeSuggestions(2028, [{ ...period, startDate: "2028-01-01", endDate: "2028-12-31" }], themes), []);
  assert.equal(annualThemeSuggestions(2028, [], [themes[0], themes[1], { ...themes[2], kind: "support" }])[0].endDate, "2028-02-29");
  assert.equal(annualThemeSuggestions(2028, [], [themes[0]]).length, 6);
  assert.ok(empty.every((proposal) => Number(proposal.endDate.slice(5, 7)) - Number(proposal.startDate.slice(5, 7)) <= 1));
});

test("skill blocks preserve chosen order, two or three sessions and coach notes", () => {
  const progression = skillProgression([{ title: "Pasning", sessions: 3 }, { title: "Medtak", sessions: 2 }], "Fra par til smålagsspill");
  assert.match(progression, /1\. Pasning: 3 økter\n2\. Medtak: 2 økter/);
  assert.match(progression, /Fra par til smålagsspill/);
  assert.match(progression, /Behold hovedtemaet/);
  assert.match(skillProgression([]), /2–3 økter/);
});

test("session skill focuses objectives without replacing annual goals or changing the theme", () => {
  const objectives = objectivesForSkill("Bli spillbar", { title: "Pasning", moments: ["Se opp", "Treff med innsiden"] });
  assert.match(objectives, /^Delferdighet: Pasning/);
  assert.match(objectives, /Treff med innsiden/);
  assert.match(objectives, /Periodens øvingsmål:\nBli spillbar/);
  assert.deepEqual(parseSkillObjectives(objectives), { title: "Pasning", moments: ["Se opp", "Treff med innsiden"], annualObjectives: "Bli spillbar" });
  assert.deepEqual(parseSkillObjectives(objectivesForSkill("Trenerens mål", { title: "Pasning", moments: ["Bare valgt moment"] }))?.moments, ["Bare valgt moment"]);
  assert.equal(parseSkillObjectives("Trenerens egne mål"), undefined);
  assert.equal(objectivesForSkill("Trenerens egne mål"), "Trenerens egne mål");
  const longObjectives = objectivesForSkill("x".repeat(8000), { title: "Pasning", moments: [] });
  assert.ok(longObjectives.endsWith("x".repeat(8000)), "coach objectives are never silently truncated");
  assert.equal(eventSchema.safeParse({ date: "2026-11-04", startTime: "17:00", endTime: "18:00", title: "Økt", theme: "Angrep", objectives: longObjectives }).success, false);
});

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

test("generation placeholders subtract calendar days across month, year and daylight-saving boundaries", () => {
  assert.equal(generationDate("2026-11-11", 3), "2026-11-08");
  assert.equal(generationDate("2027-01-02", 3), "2026-12-30");
  assert.equal(generationDate("2028-03-01", 1), "2028-02-29");
  assert.equal(generationDate("2026-03-30", 2), "2026-03-28");
  assert.equal(generationDate("2026-11-11", 0), "2026-11-11");
  assert.throws(() => generationDate("2026-11-11", 31));
  assert.throws(() => generationDate("2026-11-31", 3));
});

test("session sections combine theme and game without reordering exercises or changing time", () => {
  const exercise = completePlan().exercises[0];
  const exercises = (["warmup", "theme", "game", "closing", "warmup"] as const).map((stage, index) => ({
    ...exercise, stage, id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, durationMinutes: 5 + index,
  }));
  const sections = sessionSections(exercises);
  assert.deepEqual(sections.map((section) => section.title), ["Oppvarming", "Hoveddel", "Avslutning", "Oppvarming"]);
  assert.deepEqual(sections.map((section) => section.durationMinutes), [5, 13, 8, 9]);
  assert.deepEqual(sections.flatMap((section) => section.exercises.map((entry) => entry.exercise.id)), exercises.map((entry) => entry.id));
  assert.deepEqual(sections.flatMap((section) => section.exercises.map((entry) => entry.from)), [0, 5, 11, 18, 26]);
  assert.equal(new Set(sections.map((section) => section.id)).size, sections.length);
  assert.deepEqual(sessionSections([]), []);
});

test("annual plans calculate NFF age sources per year without generating themes", () => {
  assert.equal(nffAgeSource(2026, 2017).age, 9);
  assert.ok(nffAgeSource(2026, 2017).url.endsWith("/barn_8-9/"));
  assert.ok(nffAgeSource(2027, 2017).url.endsWith("/barn_10-11/"));
  assert.ok(nffAgeSource(2029, 2017).url.endsWith("/barn_12/"));
  assert.ok(nffAgeSource(2030, 2017).url.endsWith("/ungdom_13-16/"));
  assert.equal(nffAgeSource(2026, null).age, null);
  assert.deepEqual(annualPlanSchema.parse({ year: "2026", birthYear: 2025, objectives: "" }), { year: 2026, objectives: "" }, "annual input cannot own the team cohort");
});

test("team cohort settings allow explicit years or unknown without resetting omitted values", () => {
  assert.equal(birthYearSchema.parse("2017"), 2017);
  assert.equal(birthYearSchema.parse(""), null);
  assert.equal(birthYearSchema.parse(null), null);
  for (const value of [1899, 2101, 2017.5, "invalid", undefined]) {
    assert.equal(birthYearSchema.safeParse(value).success, false);
  }
  assert.equal(birthYearSchema.parse(1900), 1900);
  assert.equal(birthYearSchema.parse(2100), 2100);
  assert.deepEqual(settingsSchema.parse({ generationDaysBefore: 3 }), { generationDaysBefore: 3 });
  assert.equal(settingsSchema.parse({ generationDaysBefore: 3, birthYear: "" }).birthYear, null);
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
  assert.ok(!check.warnings.some((warning) => warning.includes("utstyr er ikke bekreftet")));
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
  assert.equal(checkSessionPlan(plan, 70).peak.balls, 6);
  assert.ok(!checkSessionPlan(plan, 70).warnings.some((warning) => warning.includes("tilgjengelig 5")));
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
