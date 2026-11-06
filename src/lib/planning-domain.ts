import { and, asc, desc, eq, gt, gte, lt, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/index.ts";
import { annualPlans, clubs, groups, planPeriods, sessionVersions, trainingEvents, trainingTimes } from "../db/schema.ts";
import { DomainError, getGroupAccess } from "./domain.ts";
import { idSchema, minutesBetween } from "./validation.ts";
import {
  annualPlanSchema, checkSessionPlan, datesInYear, emptySessionPlan, eventSchema, NFF_SOURCE, nffAgeSource,
  periodSchema, periodsOnDate, sessionPlanSchema, slotKey, weekdayFor, yearSchema,
  osloToday, type PlanningSnapshot,
} from "./planning.ts";

const revisionSchema = z.coerce.number().int().min(0);
async function lockGroup(db: Database, userId: string, groupId: string) {
  idSchema.parse(groupId);
  await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("update");
  return getGroupAccess(db, userId, groupId);
}
function assertRevision(actual: number, expected: unknown) {
  if (actual !== revisionSchema.parse(expected)) throw new DomainError("Planen er endret av en annen trener. Last siden på nytt før du lagrer.");
}

export async function annualPlanning(db: Database, userId: string, groupId: string, year: number) {
  const access = await getGroupAccess(db, userId, groupId);
  yearSchema.parse(year);
  const [[plan], [club]] = await Promise.all([
    db.select().from(annualPlans).where(and(eq(annualPlans.groupId, groupId), eq(annualPlans.year, year))),
    db.select().from(clubs).where(eq(clubs.id, access.group.clubId)),
  ]);
  const periods = plan ? await db.select().from(planPeriods).where(eq(planPeriods.annualPlanId, plan.id))
    .orderBy(asc(planPeriods.startDate)) : [];
  return { ...access, club, plan: plan ?? null, periods };
}

export async function saveAnnualPlan(db: Database, userId: string, groupId: string, input: unknown, revision: unknown) {
  const data = annualPlanSchema.parse(input);
  return db.transaction(async (tx) => {
    const { group } = await lockGroup(tx, userId, groupId);
    const [existing] = await tx.select().from(annualPlans).where(and(eq(annualPlans.groupId, groupId), eq(annualPlans.year, data.year)));
    assertRevision(existing?.revision ?? 0, revision);
    if (existing) {
      await tx.update(annualPlans).set({ ...data, revision: existing.revision + 1 }).where(eq(annualPlans.id, existing.id));
      return existing.id;
    }
    const [plan] = await tx.insert(annualPlans).values({ ...data, clubId: group.clubId, groupId }).returning();
    return plan.id;
  });
}

export async function savePlanPeriod(
  db: Database, userId: string, groupId: string, year: number, input: unknown, revision: unknown, periodId?: string,
) {
  const data = periodSchema.parse(input);
  yearSchema.parse(year);
  if (periodId) idSchema.parse(periodId);
  if (Number(data.startDate.slice(0, 4)) !== year) throw new DomainError("Perioden må ligge i valgt planår.");
  await db.transaction(async (tx) => {
    const { group } = await lockGroup(tx, userId, groupId);
    const [plan] = await tx.select().from(annualPlans).where(and(eq(annualPlans.groupId, groupId), eq(annualPlans.year, year)));
    if (!plan) throw new DomainError("Lagre årsplanen før du legger til perioder.");
    assertRevision(plan.revision, revision);
    const periods = await tx.select().from(planPeriods).where(eq(planPeriods.annualPlanId, plan.id));
    if (periodId && !periods.some((period) => period.id === periodId)) throw new DomainError("Perioden finnes ikke i denne årsplanen.");
    if (periods.some((period) => period.id !== periodId && period.startDate <= data.endDate && period.endDate >= data.startDate)) {
      throw new DomainError("Temaperioder kan ikke overlappe. Juster start- eller sluttdato.");
    }
    if (periodId) await tx.update(planPeriods).set(data).where(eq(planPeriods.id, periodId));
    else await tx.insert(planPeriods).values({ ...data, clubId: group.clubId, groupId, annualPlanId: plan.id });
    await tx.update(annualPlans).set({ revision: plan.revision + 1 }).where(eq(annualPlans.id, plan.id));
  });
}

export async function removePlanPeriod(db: Database, userId: string, groupId: string, periodId: string, revision: unknown) {
  idSchema.parse(periodId);
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [period] = await tx.select().from(planPeriods).where(and(eq(planPeriods.id, periodId), eq(planPeriods.groupId, groupId)));
    if (!period) throw new DomainError("Perioden finnes ikke for dette laget.");
    const [plan] = await tx.select().from(annualPlans).where(eq(annualPlans.id, period.annualPlanId));
    assertRevision(plan.revision, revision);
    await tx.delete(planPeriods).where(eq(planPeriods.id, period.id));
    await tx.update(annualPlans).set({ revision: plan.revision + 1 }).where(eq(annualPlans.id, plan.id));
  });
}

async function planningSnapshot(db: Database, userId: string, groupId: string, date: string): Promise<PlanningSnapshot> {
  const year = Number(date.slice(0, 4));
  const { group, plan, periods } = await annualPlanning(db, userId, groupId, year);
  return {
    year, birthYear: group.birthYear, annualObjectives: plan?.objectives ?? "",
    curriculum: { provider: "nff", url: nffAgeSource(year, group.birthYear).url || NFF_SOURCE, suggestions: "pending_ai" },
    periods: periodsOnDate(periods, date),
  };
}

export async function groupCalendar(db: Database, userId: string, groupId: string, year: number) {
  const annual = await annualPlanning(db, userId, groupId, year);
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const [times, saved] = await Promise.all([
    db.select().from(trainingTimes).where(and(eq(trainingTimes.groupId, groupId), eq(trainingTimes.enabled, true))),
    db.select().from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), or(
      and(gte(trainingEvents.date, start), lte(trainingEvents.date, end)),
      sql`${trainingEvents.recurrenceKey} like ${`${year}-%`}`,
    ))),
  ]);
  const hiddenSlots = new Set(saved.flatMap((event) => [event.recurrenceKey, slotKey(event.date, event.startTime)]).filter(Boolean));
  const entries = saved.filter((event) => event.date >= start && event.date <= end).map((event) => ({
    ...event, virtual: false,
  }));
  const virtual = datesInYear(year).flatMap((date) => times.filter((time) => time.weekday === weekdayFor(date))
    .filter((time) => !hiddenSlots.has(slotKey(date, time.startTime))).map((time) => {
      const period = periodsOnDate(annual.periods, date)[0];
      return {
        id: null, clubId: annual.group.clubId, groupId, date, startTime: time.startTime, endTime: time.endTime,
        durationMinutes: minutesBetween(time.startTime, time.endTime), title: `${annual.group.name} – trening`,
        theme: period?.theme ?? "", objectives: period?.objectives ?? "",
        recurrenceKey: slotKey(date, time.startTime), status: "scheduled" as const, revision: 0, virtual: true,
      };
    }));
  return { ...annual, entries: [...entries, ...virtual].sort((a, b) => slotKey(a.date, a.startTime).localeCompare(slotKey(b.date, b.startTime))) };
}

export async function groupSessions(db: Database, userId: string, groupId: string, now = new Date()) {
  const today = osloToday(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const year = Number(today.slice(0, 4));
  const current = await groupCalendar(db, userId, groupId, year);
  const [following, recent, savedUpcoming] = await Promise.all([
    year < 2100 ? groupCalendar(db, userId, groupId, year + 1) : null,
    db.select().from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), or(
      lt(trainingEvents.date, today), and(eq(trainingEvents.date, today), lte(trainingEvents.startTime, time)),
    ))).orderBy(desc(trainingEvents.date), desc(trainingEvents.startTime)).limit(5),
    db.select().from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), ne(trainingEvents.status, "cancelled"), or(
      gt(trainingEvents.date, today), and(eq(trainingEvents.date, today), gt(trainingEvents.startTime, time)),
    ))).orderBy(asc(trainingEvents.date), asc(trainingEvents.startTime)).limit(1),
  ]);
  const upcoming = [...current.entries, ...(following?.entries ?? []), ...savedUpcoming.map((event) => ({ ...event, virtual: false }))]
    .filter((event) => event.status !== "cancelled" && (event.date > today || (event.date === today && event.startTime > time)))
    .sort((a, b) => slotKey(a.date, a.startTime).localeCompare(slotKey(b.date, b.startTime)))[0] ?? null;
  return { ...current, recent, upcoming };
}

export async function createTrainingEvent(
  db: Database, userId: string, groupId: string, input: unknown, recurrenceKey: string | null = null, cancelled = false,
) {
  let data = eventSchema.parse(input);
  return db.transaction(async (tx) => {
    const { group } = await lockGroup(tx, userId, groupId);
    const times = await tx.select().from(trainingTimes).where(and(eq(trainingTimes.groupId, groupId), eq(trainingTimes.enabled, true)));
    const recurringTime = times.find((time) => time.weekday === weekdayFor(data.date) && time.startTime === data.startTime);
    const isRecurring = !!recurringTime;
    const effectiveKey = recurrenceKey ?? (isRecurring ? slotKey(data.date, data.startTime) : null);
    if (recurrenceKey !== null) {
      if (recurrenceKey !== slotKey(data.date, data.startTime)) throw new DomainError("Den faste treningstiden stemmer ikke med dato og klokkeslett.");
      const [existing] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), eq(trainingEvents.recurrenceKey, recurrenceKey)));
      if (existing) return existing.id;
      if (!isRecurring) {
        throw new DomainError("Den faste treningstiden finnes ikke lenger. Opprett eventuelt en enkeltøkt.");
      }
      data = eventSchema.parse({ ...data, endTime: recurringTime.endTime });
    }
    if (effectiveKey) {
      const [reserved] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), eq(trainingEvents.recurrenceKey, effectiveKey)));
      if (reserved) throw new DomainError("Denne faste treningen er allerede opprettet eller flyttet. Åpne den eksisterende øktplanen.");
    }
    const [conflict] = await tx.select().from(trainingEvents).where(and(
      eq(trainingEvents.groupId, groupId), eq(trainingEvents.date, data.date), eq(trainingEvents.startTime, data.startTime),
    ));
    if (conflict) throw new DomainError("Det finnes allerede en økt på dette tidspunktet. Åpne den fra kalenderen.");
    const [event] = await tx.insert(trainingEvents).values({
      ...data, clubId: group.clubId, groupId, recurrenceKey: effectiveKey, status: cancelled ? "cancelled" : "draft",
    }).returning();
    await tx.insert(sessionVersions).values({
      clubId: group.clubId, groupId, eventId: event.id, version: 1, createdBy: userId, origin: "manual",
      eventSnapshot: { ...data, status: "draft" }, plan: emptySessionPlan(), planningContext: await planningSnapshot(tx, userId, groupId, data.date),
    });
    return event.id;
  });
}

export async function trainingEventDetails(db: Database, userId: string, groupId: string, eventId: string) {
  const access = await getGroupAccess(db, userId, groupId);
  idSchema.parse(eventId);
  const [event] = await db.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
  if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
  const [versions, [club], context] = await Promise.all([
    db.select().from(sessionVersions).where(and(eq(sessionVersions.eventId, event.id), eq(sessionVersions.groupId, groupId))).orderBy(desc(sessionVersions.version)),
    db.select().from(clubs).where(eq(clubs.id, access.group.clubId)),
    planningSnapshot(db, userId, groupId, event.date),
  ]);
  if (!versions[0]) throw new DomainError("Økten mangler en planversjon. Kontakt administrator.");
  return { ...access, club, event, versions, context };
}

export async function saveSessionPlan(
  db: Database, userId: string, groupId: string, eventId: string,
  input: unknown, planInput: unknown, revision: unknown, status: "draft" | "planned",
) {
  idSchema.parse(eventId);
  const data = eventSchema.parse(input);
  const plan = sessionPlanSchema.parse(planInput);
  z.enum(["draft", "planned"]).parse(status);
  if (status === "planned") {
    const { warnings } = checkSessionPlan(plan, data.durationMinutes);
    if (!data.theme || !data.objectives) warnings.unshift("Tema og øvingsmål må fylles inn.");
    if (warnings.length) throw new DomainError(`Økten kan ikke godkjennes ennå: ${warnings.join(" ")}`);
  }
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [event] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
    if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
    assertRevision(event.revision, revision);
    if (event.status === "cancelled") throw new DomainError("Gjenåpne økten før du redigerer planen.");
    const [conflict] = await tx.select().from(trainingEvents).where(and(
      eq(trainingEvents.groupId, groupId), eq(trainingEvents.date, data.date), eq(trainingEvents.startTime, data.startTime),
      sql`${trainingEvents.id} <> ${eventId}`,
    ));
    if (conflict) throw new DomainError("Det finnes allerede en økt på det nye tidspunktet.");
    if (event.recurrenceKey !== slotKey(data.date, data.startTime)) {
      const [reserved] = await tx.select().from(trainingEvents).where(and(
        eq(trainingEvents.groupId, groupId), eq(trainingEvents.recurrenceKey, slotKey(data.date, data.startTime)),
        sql`${trainingEvents.id} <> ${eventId}`,
      ));
      if (reserved) throw new DomainError("Tidspunktet er et unntak for en annen fast trening. Velg et annet tidspunkt.");
    }
    const [latest] = await tx.select({ version: sessionVersions.version }).from(sessionVersions)
      .where(eq(sessionVersions.eventId, eventId)).orderBy(desc(sessionVersions.version)).limit(1);
    await tx.insert(sessionVersions).values({
      clubId: event.clubId, groupId, eventId, version: latest.version + 1, createdBy: userId, origin: "manual",
      eventSnapshot: { ...data, status }, plan, planningContext: await planningSnapshot(tx, userId, groupId, data.date),
    });
    await tx.update(trainingEvents).set({ ...data, status, revision: event.revision + 1 }).where(eq(trainingEvents.id, eventId));
  });
}

export async function changeTrainingStatus(
  db: Database, userId: string, groupId: string, eventId: string, revision: unknown, status: "cancelled" | "draft",
) {
  idSchema.parse(eventId);
  z.enum(["cancelled", "draft"]).parse(status);
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [event] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
    if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
    assertRevision(event.revision, revision);
    await tx.update(trainingEvents).set({ status, revision: event.revision + 1 }).where(eq(trainingEvents.id, eventId));
  });
}
