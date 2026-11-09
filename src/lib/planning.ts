import { z } from "zod";
import { minutesBetween, timeRangeSchema } from "./validation.ts";

export const NFF_SOURCE = "https://www.fotball.no/barn-og-ungdom/";
export const yearSchema = z.coerce.number().int().min(2000).max(2100);
export const dateSchema = z.iso.date("Oppgi en gyldig dato.").refine((value) =>
  Number(value.slice(0, 4)) >= 2000 && Number(value.slice(0, 4)) <= 2100, "Datoen må være mellom 2000 og 2100.");
const text = z.string().trim().max(8000);
const optionalCount = z.preprocess((value) => value === "" || value === undefined ? null : value,
  z.coerce.number().int().min(0).max(500).nullable());
export const sourceUrlSchema = z.union([
  z.literal(""),
  z.url().max(2000).refine((value) => {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  }, "Kildelenken må være en http(s)-adresse uten brukernavn/passord."),
]);
export const annualPlanSchema = z.object({
  year: yearSchema,
  objectives: text,
});
export const annualEventLabels = { cup: "Cup", holiday: "Ferie / fridag", other: "Annen hendelse" };
export const annualEventSchema = z.object({
  title: z.string().trim().min(2, "Tittelen må ha minst to tegn.").max(150),
  kind: z.enum(["cup", "holiday", "other"]),
  startDate: dateSchema,
  endDate: dateSchema,
  description: text,
}).refine((value) => value.endDate >= value.startDate, "Sluttdato må være etter eller lik startdato.");
export type AnnualEventInput = z.infer<typeof annualEventSchema>;
export type AnnualEvent = AnnualEventInput & { id: string; revision: number };
export function eventsDuring<T extends { startDate: string; endDate: string }>(events: T[], start: string, end = start) {
  return events.filter((event) => event.startDate <= end && event.endDate >= start);
}
export const periodSchema = z.object({
  startDate: dateSchema, endDate: dateSchema,
  theme: z.string().trim().min(2).max(150),
  objectives: text.min(1, "Oppgi minst ett øvingsmål."),
  progression: text, sourceUrl: sourceUrlSchema,
}).refine((value) => value.endDate >= value.startDate && value.startDate.slice(0, 4) === value.endDate.slice(0, 4),
  "Perioden må ligge innenfor ett kalenderår, med sluttdato etter eller lik startdato.");

export const eventSchema = timeRangeSchema.safeExtend({
  date: dateSchema,
  title: z.string().trim().min(2).max(150),
  theme: z.string().trim().max(150),
  objectives: text,
}).transform((data) => ({ ...data, durationMinutes: minutesBetween(data.startTime, data.endTime) }));
export const stageLabels = {
  warmup: "Oppvarming / sjef over ballen",
  theme: "Temaarbeid / spille med og mot",
  game: "Spill / smålagsspill",
  closing: "Avslutning og oppsummering",
};
export function sessionSections(exercises: Exercise[]) {
  const sections: { id: string; title: string; durationMinutes: number; exercises: { exercise: Exercise; from: number; index: number }[] }[] = [];
  let from = 0;
  for (const [index, exercise] of exercises.entries()) {
    const title = exercise.stage === "warmup" ? "Oppvarming" : exercise.stage === "closing" ? "Avslutning" : "Hoveddel";
    let section = sections.at(-1);
    if (!section || section.title !== title) {
      section = { id: `del-${sections.length + 1}`, title, durationMinutes: 0, exercises: [] };
      sections.push(section);
    }
    section.exercises.push({ exercise, from, index });
    section.durationMinutes += exercise.durationMinutes;
    from += exercise.durationMinutes;
  }
  return sections;
}
export const exerciseSchema = z.object({
  id: z.uuid(),
  stage: z.enum(["warmup", "theme", "game", "closing"]),
  title: z.string().trim().min(1).max(150),
  durationMinutes: z.coerce.number().int().min(1).max(240),
  objectives: text, organization: text, description: text, coachingPoints: text,
  easier: text, harder: text, localAdaptations: text,
  sourceUrl: sourceUrlSchema, sourceAge: z.string().trim().max(100),
  sourceCheckedOn: z.union([z.literal(""), dateSchema]),
  simultaneousGroups: optionalCount,
  assignedPlayers: optionalCount, coaches: optionalCount,
  balls: optionalCount, reserveBalls: optionalCount, smallGoals: optionalCount, largeGoals: optionalCount,
});
export const sessionPlanSchema = z.object({
  schemaVersion: z.literal(1),
  introduction: text,
  expectedPlayers: optionalCount, confirmedCoaches: optionalCount,
  availableBalls: optionalCount, availableSmallGoals: optionalCount, availableLargeGoals: optionalCount,
  equipmentConfirmed: z.boolean(),
  assumptions: text, coachRoles: text, alternatives: text, progression: text,
  exercises: z.array(exerciseSchema).max(30),
}).superRefine((value, context) => {
  if (new Set(value.exercises.map((exercise) => exercise.id)).size !== value.exercises.length) {
    context.addIssue({ code: "custom", path: ["exercises"], message: "Øvelsene må ha unike ID-er." });
  }
});
export type SessionPlan = z.infer<typeof sessionPlanSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type Period = z.infer<typeof periodSchema> & { id: string };
export type PlanningSnapshot = {
  year: number; birthYear: number | null; annualObjectives: string;
  curriculum: { provider: "nff"; url: string; suggestions: "pending_ai" };
  events?: AnnualEventInput[];
  periods: Period[];
};

export function emptySessionPlan(): SessionPlan {
  return {
    schemaVersion: 1, introduction: "", expectedPlayers: null, confirmedCoaches: null,
    availableBalls: null, availableSmallGoals: null, availableLargeGoals: null,
    equipmentConfirmed: false, assumptions: "", coachRoles: "", alternatives: "", progression: "", exercises: [],
  };
}

export function nffAgeSource(year: number, birthYear: number | null) {
  if (birthYear === null) return { age: null, url: NFF_SOURCE, label: "Velg årskull for aldersriktig fagplan" };
  const age = year - birthYear;
  const path = age <= 7 && age >= 6 ? "barn_6-7" : age <= 9 && age >= 8 ? "barn_8-9" :
    age <= 11 && age >= 10 ? "barn_10-11" : age === 12 ? "barn_12" :
      age >= 13 && age <= 16 ? "ungdom_13-16" : age >= 17 && age <= 19 ? "ungdom_17-19" : null;
  return { age, url: path ? `${NFF_SOURCE}${path}/` : NFF_SOURCE, label: `${age} år i ${year}` };
}

export function osloToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function generationDate(date: string, daysBefore: number) {
  dateSchema.parse(date);
  z.number().int().min(0).max(30).parse(daysBefore);
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - daysBefore);
  return day.toISOString().slice(0, 10);
}
export function datesInYear(year: number) {
  yearSchema.parse(year);
  const days: string[] = [];
  for (let day = new Date(Date.UTC(year, 0, 1)); day.getUTCFullYear() === year; day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}
export function weekdayFor(date: string) {
  dateSchema.parse(date);
  return new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
}
export const slotKey = (date: string, startTime: string) => `${date}T${startTime}`;
export function periodsOnDate(periods: Period[], date: string) {
  return periods.filter((period) => period.startDate <= date && period.endDate >= date);
}

export function skillProgression(blocks: { title: string; sessions: number }[], notes = "") {
  const sequence = blocks.length ? `Delferdigheter i rekkefølge:\n${blocks.map((block, index) => `${index + 1}. ${block.title}: ${block.sessions} økter`).join("\n")}\n\n` : "";
  return `${sequence}Behold hovedtemaet gjennom perioden. Viderefør de fleste øvelsene i 2–3 økter per delferdighet, med små justeringer i rom, motstand eller regler.\n${notes}`.trim();
}

export function objectivesForSkill(objectives: string, skill?: { title: string; moments: string[] }) {
  if (!skill) return objectives;
  return `Delferdighet: ${skill.title}\n${skill.moments.join("\n")}\n\nPeriodens øvingsmål:\n${objectives}`;
}

export function parseSkillObjectives(objectives: string) {
  const marker = "\n\nPeriodens øvingsmål:\n";
  const boundary = objectives.indexOf(marker);
  if (!objectives.startsWith("Delferdighet: ") || boundary < 0) return undefined;
  const lines = objectives.slice(0, boundary).split("\n");
  return { title: lines[0].slice("Delferdighet: ".length), moments: lines.slice(1).filter(Boolean), annualObjectives: objectives.slice(boundary + marker.length) };
}

export function selectedMomentIndices(skill: { id: string; moments: string[] } | undefined, choice: { id: string; indices: number[] } | null,
  storedMoments?: string[]) {
  if (!skill) return [];
  if (choice?.id === skill.id) return choice.indices;
  return storedMoments ? skill.moments.flatMap((moment, index) => storedMoments.includes(moment) ? [index] : [])
    : skill.moments.map((_, index) => index).slice(0, 2);
}

export function skillForSession<Skill extends { title: string }>(skills: Skill[], sessionIndex: number, progression = ""): Skill | undefined {
  const planned = [...progression.matchAll(/^\d+\.\s+(.+):\s+([23]) økter\s*$/gm)].flatMap((match) => {
    const skill = skills.find((item) => item.title === match[1]);
    return skill ? [{ skill, sessions: Number(match[2]) }] : [];
  });
  const blocks = planned.length ? planned : skills.map((skill) => ({ skill, sessions: 3 }));
  const total = blocks.reduce((sum, block) => sum + block.sessions, 0);
  if (!total) return undefined;
  let position = sessionIndex % total;
  for (const block of blocks) {
    if (position < block.sessions) return block.skill;
    position -= block.sessions;
  }
}

export type ThemeSuggestion = Period & { topicId: string };
export function planningThemeDrop(source: unknown, target: unknown) {
  const theme = z.object({ topicId: z.string().min(1), theme: z.string().min(1) }).safeParse(source);
  const month = z.object({ month: z.number().int().min(1).max(12) }).safeParse(target);
  return theme.success && month.success ? { topicId: theme.data.topicId, month: month.data.month } : null;
}

export function themePeriodContent(topic: { theme: string; moments: string[]; sourceUrl: string; skills: { title: string }[] }) {
  return { theme: topic.theme, objectives: topic.moments.join("\n") || `Arbeide med hovedtemaet ${topic.theme}.`,
    progression: skillProgression(topic.skills.slice(0, 3).map((skill) => ({ title: skill.title, sessions: 3 }))), sourceUrl: topic.sourceUrl };
}

export function annualThemeSuggestions(year: number, periods: Period[], topics: {
  id: string; kind: string; theme: string; moments: string[]; sourceUrl: string; skills: { title: string }[];
}[]): ThemeSuggestion[] {
  yearSchema.parse(year);
  const themes = topics.filter((topic) => topic.kind === "main").slice(0, 12);
  if (!themes.length) return [];
  const result: ThemeSuggestion[] = [];
  for (let month = 1; month <= 12; month++) {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const startDate = `${prefix}-01`;
    const endDate = `${prefix}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
    if (periods.some((period) => period.startDate <= endDate && period.endDate >= startDate)) continue;
    const topic = themes[Math.floor((month - 1) * Math.max(6, themes.length) / 12) % themes.length];
    const previous = result.at(-1);
    if (previous?.topicId === topic.id && Number(previous.endDate.slice(5, 7)) === month - 1 && month - Number(previous.startDate.slice(5, 7)) < 2) {
      previous.endDate = endDate;
    } else result.push({ id: `forslag-${year}-${month}-${topic.id}`, topicId: topic.id, startDate, endDate, ...themePeriodContent(topic) });
  }
  return result;
}

export function checkSessionPlan(plan: SessionPlan, durationMinutes: number) {
  const warnings: string[] = [];
  const totalMinutes = plan.exercises.reduce((total, exercise) => total + exercise.durationMinutes, 0);
  if (!plan.exercises.length) warnings.push("Økten mangler øvelser.");
  if (totalMinutes !== durationMinutes) warnings.push(`Tidsplanen er ${totalMinutes} minutter, men økten varer ${durationMinutes}. Ta med forklaring, pauser og bytter.`);
  if (!plan.expectedPlayers) warnings.push("Forventet spillerantall er ikke oppgitt.");
  if (!plan.confirmedCoaches) warnings.push("Bekreftet treneroppmøte er ikke oppgitt.");
  if (!plan.equipmentConfirmed) warnings.push("Tilgjengelig utstyr er ikke bekreftet.");
  if (!plan.coachRoles) warnings.push("Trenerroller er ikke beskrevet.");
  if (!plan.alternatives) warnings.push("Alternativer ved endret oppmøte, utstyr eller forhold mangler.");
  const peak = { balls: 0, smallGoals: 0, largeGoals: 0, coaches: 0 };
  for (const [index, exercise] of plan.exercises.entries()) {
    const prefix = `${index + 1}. ${exercise.title}`;
    if (!exercise.description || !exercise.organization || !exercise.objectives || !exercise.coachingPoints) warnings.push(`${prefix}: fyll inn mål, organisering, gjennomføring og læringsmomenter.`);
    if (!exercise.easier || !exercise.harder) warnings.push(`${prefix}: enklere/vanskeligere variant mangler.`);
    if (exercise.sourceUrl && (!exercise.sourceAge || !exercise.sourceCheckedOn)) warnings.push(`${prefix}: kildens alder og kontrolldato er ikke registrert.`);
    if (!exercise.sourceUrl && !exercise.localAdaptations) warnings.push(`${prefix}: oppgi kildelenke eller beskriv aktiviteten som lokalt opplegg.`);
    if (!exercise.simultaneousGroups || exercise.assignedPlayers === null || exercise.coaches === null) warnings.push(`${prefix}: samtidige grupper, fordelte spillere eller trenerbehov er uavklart.`);
    if (exercise.assignedPlayers !== null && exercise.assignedPlayers !== plan.expectedPlayers) warnings.push(`${prefix}: spillerfordelingen stemmer ikke med forventet oppmøte.`);
    const resources = [exercise.balls, exercise.reserveBalls, exercise.smallGoals, exercise.largeGoals];
    if (resources.some((value) => value === null)) warnings.push(`${prefix}: samlet utstyrsbehov på alle samtidige flater må fylles inn, også nullverdier.`);
    const balls = (exercise.balls ?? 0) + (exercise.reserveBalls ?? 0);
    peak.balls = Math.max(peak.balls, balls);
    peak.smallGoals = Math.max(peak.smallGoals, exercise.smallGoals ?? 0);
    peak.largeGoals = Math.max(peak.largeGoals, exercise.largeGoals ?? 0);
    peak.coaches = Math.max(peak.coaches, exercise.coaches ?? 0);
  }
  for (const [label, required, available] of [
    ["Baller inkludert reserve", peak.balls, plan.availableBalls],
    ["Småmål", peak.smallGoals, plan.availableSmallGoals],
    ["Store mål", peak.largeGoals, plan.availableLargeGoals],
    ["Trenere", peak.coaches, plan.confirmedCoaches],
  ] as const) {
    if (available === null) warnings.push(`${label}: tilgjengelig antall er ukjent.`);
    else if (required > available) warnings.push(`${label}: trenger ${required}, tilgjengelig ${available}.`);
  }
  const hasExercises = plan.exercises.length > 0;
  return { warnings, totalMinutes, peak: {
    balls: hasExercises && plan.exercises.every((exercise) => exercise.balls !== null && exercise.reserveBalls !== null) ? peak.balls : null,
    smallGoals: hasExercises && plan.exercises.every((exercise) => exercise.smallGoals !== null) ? peak.smallGoals : null,
    largeGoals: hasExercises && plan.exercises.every((exercise) => exercise.largeGoals !== null) ? peak.largeGoals : null,
    coaches: hasExercises && plan.exercises.every((exercise) => exercise.coaches !== null) ? peak.coaches : null,
  } };
}
