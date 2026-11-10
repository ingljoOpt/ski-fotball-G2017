import { and, asc, desc, eq, gt, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/index.ts";
import { annualEvents, annualPlans, clubs, generationJobs, groupMembers, groups, planPeriods, planningHistory, sessionVersions, trainingEvents, trainingTimes, users } from "../db/schema.ts";
import { DomainError, getGroupAccess } from "./domain.ts";
import { idSchema, minutesBetween } from "./validation.ts";
import {
  annualPlanSchema, checkSessionPlan, datesInYear, emptySessionPlan, eventSchema, NFF_SOURCE, nffAgeSource,
  periodSchema, periodsOnDate, sessionPlanSchema, slotKey, weekdayFor, yearSchema,
  annualEventSchema, eventsDuring, generationDate, osloToday, type PlanningSnapshot,
} from "./planning.ts";
import { sameAIDraft, type AIDraft, type AIProposal } from "./session-ai.ts";

const revisionSchema = z.coerce.number().int().min(0);
async function lockGroup(db: Database, userId: string, groupId: string) {
  idSchema.parse(groupId);
  await db.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("update");
  return getGroupAccess(db, userId, groupId);
}
function sessionSnapshot(event: {
  date: string; startTime: string; endTime: string; durationMinutes: number; title: string; theme: string; objectives: string;
  status: "draft" | "planned";
}, plan: ReturnType<typeof emptySessionPlan> | null, cancelled = false) {
  return { event: { date: event.date, startTime: event.startTime, endTime: event.endTime,
    durationMinutes: event.durationMinutes, title: event.title, theme: event.theme, objectives: event.objectives, status: event.status }, plan, cancelled };
}
function displayEventStatus(event: { status: "draft" | "planned" | "cancelled"; cancelledAt: Date | null; planDeletedAt: Date | null }) {
  return event.cancelledAt || event.status === "cancelled" ? "cancelled" as const
    : event.planDeletedAt ? "no_plan" as const : event.status;
}
async function writeHistory(tx: Database, entry: typeof planningHistory.$inferInsert) {
  await tx.insert(planningHistory).values(entry);
}
async function readHistory(db: Database, conditions: ReturnType<typeof and>) {
  return db.select({
    id: planningHistory.id, planYear: planningHistory.planYear, entityType: planningHistory.entityType,
    entityId: planningHistory.entityId, action: planningHistory.action, actorType: planningHistory.actorType,
    beforeSnapshot: planningHistory.beforeSnapshot, afterSnapshot: planningHistory.afterSnapshot,
    createdAt: planningHistory.createdAt, actorEmail: users.email,
  }).from(planningHistory).leftJoin(users, eq(planningHistory.actorId, users.id)).where(conditions)
    .orderBy(desc(planningHistory.createdAt), desc(planningHistory.id));
}
function assertRevision(actual: number, expected: unknown) {
  if (actual !== revisionSchema.parse(expected)) throw new DomainError("Planen er endret av en annen trener. Last siden på nytt før du lagrer.");
}

export async function sessionCoaches(db: Database, groupId: string) {
  return db.select({ userId: users.id, email: users.email }).from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId)).where(eq(groupMembers.groupId, groupId)).orderBy(asc(users.email));
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
  const events = await db.select().from(annualEvents).where(and(eq(annualEvents.groupId, groupId),
    lte(annualEvents.startDate, `${year}-12-31`), gte(annualEvents.endDate, `${year}-01-01`)))
    .orderBy(asc(annualEvents.startDate), asc(annualEvents.title));
  return { ...access, club, plan: plan ?? null, periods, events };
}

export async function annualPlanHistory(db: Database, userId: string, groupId: string, year: number) {
  await getGroupAccess(db, userId, groupId);
  yearSchema.parse(year);
  return readHistory(db, and(eq(planningHistory.groupId, groupId), eq(planningHistory.planYear, year),
    or(eq(planningHistory.entityType, "annual_plan"), eq(planningHistory.entityType, "plan_period"))));
}

export async function saveAnnualEvent(db: Database, userId: string, groupId: string, input: unknown, eventId?: string, revision: unknown = 0) {
  const data = annualEventSchema.parse(input);
  if (eventId) idSchema.parse(eventId);
  return db.transaction(async (tx) => {
    const { group } = await lockGroup(tx, userId, groupId);
    if (!eventId) {
      const [event] = await tx.insert(annualEvents).values({ ...data, clubId: group.clubId, groupId, createdBy: userId, updatedBy: userId }).returning();
      return event.id;
    }
    const [existing] = await tx.select().from(annualEvents).where(and(eq(annualEvents.id, eventId), eq(annualEvents.groupId, groupId)));
    if (!existing) throw new DomainError("Hendelsen finnes ikke for dette laget.");
    assertRevision(existing.revision, revision);
    await tx.update(annualEvents).set({ ...data, revision: existing.revision + 1, updatedBy: userId, updatedAt: new Date() })
      .where(eq(annualEvents.id, eventId));
    return eventId;
  });
}

export async function removeAnnualEvent(db: Database, userId: string, groupId: string, eventId: string, revision: unknown) {
  idSchema.parse(eventId);
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [existing] = await tx.select().from(annualEvents).where(and(eq(annualEvents.id, eventId), eq(annualEvents.groupId, groupId)));
    if (!existing) throw new DomainError("Hendelsen finnes ikke for dette laget.");
    assertRevision(existing.revision, revision);
    await tx.delete(annualEvents).where(eq(annualEvents.id, eventId));
  });
}

export async function saveAnnualPlan(db: Database, userId: string, groupId: string, input: unknown, revision: unknown) {
  const data = annualPlanSchema.parse(input);
  return db.transaction(async (tx) => {
    const { group } = await lockGroup(tx, userId, groupId);
    const [existing] = await tx.select().from(annualPlans).where(and(eq(annualPlans.groupId, groupId), eq(annualPlans.year, data.year)));
    assertRevision(existing?.revision ?? 0, revision);
    if (existing) {
      await tx.update(annualPlans).set({ ...data, revision: existing.revision + 1 }).where(eq(annualPlans.id, existing.id));
      await writeHistory(tx, {
        clubId: group.clubId, groupId, planYear: data.year, entityType: "annual_plan", entityId: existing.id,
        action: "updated", actorType: "user", actorId: userId,
        beforeSnapshot: { year: existing.year, objectives: existing.objectives },
        afterSnapshot: { year: data.year, objectives: data.objectives },
      });
      return existing.id;
    }
    const [plan] = await tx.insert(annualPlans).values({ ...data, clubId: group.clubId, groupId }).returning();
    await writeHistory(tx, {
      clubId: group.clubId, groupId, planYear: data.year, entityType: "annual_plan", entityId: plan.id,
      action: "created", actorType: "user", actorId: userId, beforeSnapshot: null,
      afterSnapshot: { year: data.year, objectives: data.objectives },
    });
    return plan.id;
  });
}

export async function savePlanPeriod(
  db: Database, userId: string, groupId: string, year: number, input: unknown, revision: unknown, periodId?: string, createAnnualPlan = false,
) {
  const data = periodSchema.parse(input);
  yearSchema.parse(year);
  if (periodId) idSchema.parse(periodId);
  if (Number(data.startDate.slice(0, 4)) !== year) throw new DomainError("Perioden må ligge i valgt planår.");
  await db.transaction(async (tx) => {
    const { group } = await lockGroup(tx, userId, groupId);
    let [plan] = await tx.select().from(annualPlans).where(and(eq(annualPlans.groupId, groupId), eq(annualPlans.year, year)));
    if (!plan) {
      if (!createAnnualPlan || periodId) throw new DomainError("Lagre årsplanen før du legger til perioder.");
      assertRevision(0, revision);
      [plan] = await tx.insert(annualPlans).values({ year, objectives: "", clubId: group.clubId, groupId }).returning();
      await writeHistory(tx, { clubId: group.clubId, groupId, planYear: year, entityType: "annual_plan", entityId: plan.id,
        action: "created", actorType: "user", actorId: userId, beforeSnapshot: null, afterSnapshot: { year, objectives: "" } });
    } else assertRevision(plan.revision, revision);
    const periods = await tx.select().from(planPeriods).where(eq(planPeriods.annualPlanId, plan.id));
    if (periodId && !periods.some((period) => period.id === periodId)) throw new DomainError("Perioden finnes ikke i denne årsplanen.");
    if (periods.some((period) => period.id !== periodId && period.startDate <= data.endDate && period.endDate >= data.startDate)) {
      throw new DomainError("Temaperioder kan ikke overlappe. Juster start- eller sluttdato.");
    }
    const existing = periods.find((period) => period.id === periodId);
    const period = existing
      ? (await tx.update(planPeriods).set(data).where(eq(planPeriods.id, existing.id)).returning())[0]
      : (await tx.insert(planPeriods).values({ ...data, clubId: group.clubId, groupId, annualPlanId: plan.id }).returning())[0];
    await tx.update(annualPlans).set({ revision: plan.revision + 1 }).where(eq(annualPlans.id, plan.id));
    await writeHistory(tx, {
      clubId: group.clubId, groupId, planYear: year, entityType: "plan_period", entityId: period.id, parentId: plan.id,
      action: existing ? "updated" : "created", actorType: "user", actorId: userId,
      beforeSnapshot: existing ? {
        startDate: existing.startDate, endDate: existing.endDate, theme: existing.theme,
        objectives: existing.objectives, progression: existing.progression, sourceUrl: existing.sourceUrl,
      } : null,
      afterSnapshot: {
        startDate: period.startDate, endDate: period.endDate, theme: period.theme,
        objectives: period.objectives, progression: period.progression, sourceUrl: period.sourceUrl,
      },
    });
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
    await writeHistory(tx, {
      clubId: period.clubId, groupId, planYear: plan.year, entityType: "plan_period", entityId: period.id, parentId: plan.id,
      action: "deleted", actorType: "user", actorId: userId,
      beforeSnapshot: {
        startDate: period.startDate, endDate: period.endDate, theme: period.theme,
        objectives: period.objectives, progression: period.progression, sourceUrl: period.sourceUrl,
      },
      afterSnapshot: null,
    });
  });
}

export async function unlockPlanMonth(db: Database, userId: string, groupId: string, periodId: string, monthInput: unknown, revision: unknown) {
  idSchema.parse(periodId);
  const month = z.coerce.number().int().min(1).max(12).parse(monthInput);
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [period] = await tx.select().from(planPeriods).where(and(eq(planPeriods.id, periodId), eq(planPeriods.groupId, groupId)));
    if (!period) throw new DomainError("Temaet finnes ikke for dette laget.");
    const [plan] = await tx.select().from(annualPlans).where(eq(annualPlans.id, period.annualPlanId));
    assertRevision(plan.revision, revision);
    const prefix = `${plan.year}-${String(month).padStart(2, "0")}`;
    const start = `${prefix}-01`;
    const end = `${prefix}-${new Date(Date.UTC(plan.year, month, 0)).getUTCDate()}`;
    if (period.endDate < start || period.startDate > end) throw new DomainError("Temaet er ikke låst i denne måneden.");
    const snapshot = { startDate: period.startDate, endDate: period.endDate, theme: period.theme,
      objectives: period.objectives, progression: period.progression, sourceUrl: period.sourceUrl };
    const remaining = [];
    if (period.startDate < start) remaining.push({ ...snapshot, endDate: new Date(Date.UTC(plan.year, month - 1, 0)).toISOString().slice(0, 10) });
    if (period.endDate > end) remaining.push({ ...snapshot, startDate: new Date(Date.UTC(plan.year, month, 1)).toISOString().slice(0, 10) });
    if (remaining.length) await tx.update(planPeriods).set(remaining[0]).where(eq(planPeriods.id, period.id));
    else await tx.delete(planPeriods).where(eq(planPeriods.id, period.id));
    await writeHistory(tx, { clubId: period.clubId, groupId, planYear: plan.year, entityType: "plan_period", entityId: period.id, parentId: plan.id,
      action: remaining.length ? "updated" : "deleted", actorType: "user", actorId: userId, beforeSnapshot: snapshot, afterSnapshot: remaining[0] ?? null });
    if (remaining[1]) {
      const [split] = await tx.insert(planPeriods).values({ ...remaining[1], clubId: period.clubId, groupId, annualPlanId: plan.id }).returning();
      await writeHistory(tx, { clubId: period.clubId, groupId, planYear: plan.year, entityType: "plan_period", entityId: split.id, parentId: plan.id,
        action: "created", actorType: "user", actorId: userId, beforeSnapshot: null, afterSnapshot: remaining[1] });
    }
    await tx.update(annualPlans).set({ revision: plan.revision + 1 }).where(eq(annualPlans.id, plan.id));
  });
}

async function planningSnapshot(db: Database, userId: string, groupId: string, date: string): Promise<PlanningSnapshot> {
  const year = Number(date.slice(0, 4));
  const { group, plan, periods, events } = await annualPlanning(db, userId, groupId, year);
  return {
    year, birthYear: group.birthYear, annualObjectives: plan?.objectives ?? "",
    curriculum: { provider: "nff", url: nffAgeSource(year, group.birthYear).url || NFF_SOURCE, suggestions: "pending_ai" },
    periods: periodsOnDate(periods, date),
    events: eventsDuring(events, date).map(({ title, kind, startDate, endDate, description }) => ({ title, kind, startDate, endDate, description })),
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
    ...event, status: displayEventStatus(event), virtual: false,
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
    db.select().from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), isNull(trainingEvents.cancelledAt), or(
      gt(trainingEvents.date, today), and(eq(trainingEvents.date, today), gt(trainingEvents.startTime, time)),
    ))).orderBy(asc(trainingEvents.date), asc(trainingEvents.startTime)).limit(1),
  ]);
  const upcoming = [...current.entries, ...(following?.entries ?? []), ...savedUpcoming.map((event) => ({
    ...event, status: displayEventStatus(event), virtual: false,
  }))]
    .filter((event) => event.status !== "cancelled" && (event.date > today || (event.date === today && event.startTime > time)))
    .sort((a, b) => slotKey(a.date, a.startTime).localeCompare(slotKey(b.date, b.startTime)))[0] ?? null;
  return { ...current, recent: recent.map((event) => ({ ...event, status: displayEventStatus(event) })), upcoming };
}

export async function createTrainingEvent(
  db: Database, userId: string, groupId: string, input: unknown, recurrenceKey: string | null = null, cancelled = false, coachInput = "", selectedCoachIds?: unknown,
) {
  let data = eventSchema.parse(input);
  const trainerInput = z.string().trim().max(8000).parse(coachInput);
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
    if (conflict) throw new DomainError("Det finnes allerede en økt på dette tidspunktet. Åpne den fra årsplanen.");
    const [event] = await tx.insert(trainingEvents).values({
      ...data, coachInput: trainerInput, clubId: group.clubId, groupId, recurrenceKey: effectiveKey, status: "draft", cancelledAt: cancelled ? new Date() : null,
    }).returning();
    const members = await sessionCoaches(tx, groupId);
    const coachIds = selectedCoachIds === undefined ? members.map((member) => member.userId) : z.array(idSchema).max(500).parse(selectedCoachIds);
    if (new Set(coachIds).size !== coachIds.length || coachIds.some((id) => !members.some((member) => member.userId === id))) {
      throw new DomainError("Velg bare trenere som er medlemmer av laget.");
    }
    const plan = { ...emptySessionPlan(), coachIds, confirmedCoaches: coachIds.length };
    await tx.insert(sessionVersions).values({
      clubId: group.clubId, groupId, eventId: event.id, version: 1, createdBy: userId, origin: "manual",
      eventSnapshot: { ...data, status: event.status }, plan, planningContext: await planningSnapshot(tx, userId, groupId, data.date),
    });
    await writeHistory(tx, {
      clubId: group.clubId, groupId, planYear: Number(event.date.slice(0, 4)), entityType: "session", entityId: event.id,
      action: "created", actorType: "user", actorId: userId, beforeSnapshot: null,
      afterSnapshot: sessionSnapshot(event, plan),
    });
    return event.id;
  });
}

export async function saveScheduledSessionPlan(db: Database, userId: string, groupId: string, timeId: string,
  jobId: string, leaseToken: string, initial: AIDraft, proposal: AIProposal, now: Date) {
  const data = eventSchema.parse(proposal.draft.event);
  const plan = sessionPlanSchema.parse(proposal.draft.plan);
  const today = osloToday(now);
  const localTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  if (!sameAIDraft(initial, proposal.baseDraft) || JSON.stringify(plan.coachIds) !== JSON.stringify(initial.plan.coachIds) ||
    plan.coachAttendanceConfirmed !== initial.plan.coachAttendanceConfirmed || data.date !== initial.event.date || data.startTime !== initial.event.startTime ||
    data.endTime !== initial.event.endTime || checkSessionPlan(plan, data.durationMinutes).totalMinutes !== data.durationMinutes ||
    (["expectedPlayers", "confirmedCoaches", "availableBalls", "availableSmallGoals", "availableLargeGoals", "equipmentConfirmed"] as const)
      .some((key) => plan[key] !== initial.plan[key])) throw new DomainError("AI-utkastet samsvarer ikke med treningens rammer.");
  return db.transaction(async (tx) => {
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).for("update");
    if (!group) return false;
    const [job] = await tx.select().from(generationJobs).where(and(eq(generationJobs.id, jobId), eq(generationJobs.groupId, groupId),
      eq(generationJobs.leaseToken, leaseToken), eq(generationJobs.status, "running"), gt(generationJobs.leaseUntil, new Date()))).for("update");
    if (!job || job.date !== data.date || job.startTime !== data.startTime) return false;
    const [head] = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(
      eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId), eq(groupMembers.role, "head_coach")));
    const currentCoachIds = (await sessionCoaches(tx, groupId)).map((member) => member.userId).sort();
    if (initial.plan.coachIds && JSON.stringify([...initial.plan.coachIds].sort()) !== JSON.stringify(currentCoachIds)) {
      await tx.update(generationJobs).set({ status: "failed", updatedAt: new Date() }).where(eq(generationJobs.id, job.id));
      return false;
    }
    const [time] = await tx.select().from(trainingTimes).where(and(eq(trainingTimes.id, timeId), eq(trainingTimes.groupId, groupId))).for("update");
    const eligible = group.autoDraftEnabled && head && time?.enabled && time.weekday === weekdayFor(data.date) &&
      time.startTime === data.startTime && time.endTime === data.endTime && data.date >= today &&
      (data.date !== today || data.startTime > localTime) && generationDate(data.date, group.generationDaysBefore) <= today;
    if (!eligible) {
      await tx.update(generationJobs).set({ status: "failed", updatedAt: new Date() }).where(eq(generationJobs.id, job.id));
      return false;
    }
    const key = slotKey(data.date, data.startTime);
    const [existing] = await tx.select({ id: trainingEvents.id }).from(trainingEvents).where(and(eq(trainingEvents.groupId, groupId), or(
      eq(trainingEvents.recurrenceKey, key), and(eq(trainingEvents.date, data.date), eq(trainingEvents.startTime, data.startTime)),
    )));
    if (existing) {
      await tx.update(generationJobs).set({ status: "completed", updatedAt: new Date() }).where(eq(generationJobs.id, job.id));
      return false;
    }
    const [event] = await tx.insert(trainingEvents).values({ ...data, clubId: group.clubId, groupId, recurrenceKey: key, status: "draft" }).returning();
    await tx.insert(sessionVersions).values({ clubId: group.clubId, groupId, eventId: event.id, version: 1, createdBy: null, origin: "ai",
      eventSnapshot: { ...data, status: "draft" }, plan, planningContext: await planningSnapshot(tx, userId, groupId, data.date) });
    await writeHistory(tx, { clubId: group.clubId, groupId, planYear: Number(data.date.slice(0, 4)), entityType: "session", entityId: event.id,
      action: "created", actorType: "system", actorId: null, beforeSnapshot: null, afterSnapshot: sessionSnapshot(event, plan) });
    await tx.update(generationJobs).set({ status: "completed", updatedAt: new Date() }).where(eq(generationJobs.id, job.id));
    return true;
  });
}

export async function trainingEventDetails(db: Database, userId: string, groupId: string, eventId: string) {
  const access = await getGroupAccess(db, userId, groupId);
  idSchema.parse(eventId);
  const [event] = await db.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
  if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
  const [versions, [club], context, coaches] = await Promise.all([
    db.select().from(sessionVersions).where(and(eq(sessionVersions.eventId, event.id), eq(sessionVersions.groupId, groupId))).orderBy(desc(sessionVersions.version)),
    db.select().from(clubs).where(eq(clubs.id, access.group.clubId)),
    planningSnapshot(db, userId, groupId, event.date),
    sessionCoaches(db, groupId),
  ]);
  if (!versions[0]) throw new DomainError("Økten mangler en planversjon. Kontakt administrator.");
  return { ...access, club, event: { ...event, status: displayEventStatus(event) }, versions, context, coaches };
}

export async function sessionHistory(db: Database, userId: string, groupId: string, eventId: string) {
  const access = await getGroupAccess(db, userId, groupId);
  idSchema.parse(eventId);
  const [event] = await db.select({ id: trainingEvents.id }).from(trainingEvents)
    .where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
  if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
  return readHistory(db, and(eq(planningHistory.groupId, access.group.id), eq(planningHistory.entityType, "session"),
    eq(planningHistory.entityId, event.id)));
}

export async function saveSessionPlan(
  db: Database, userId: string, groupId: string, eventId: string,
  input: unknown, planInput: unknown, revision: unknown, status: "draft" | "planned", origin: "manual" | "ai" = "manual",
) {
  idSchema.parse(eventId);
  const data = eventSchema.parse(input);
  const plan = sessionPlanSchema.parse(planInput);
  delete plan.coachAttendanceConfirmed;
  z.enum(["draft", "planned"]).parse(status);
  z.enum(["manual", "ai"]).parse(origin);
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
    if (event.cancelledAt) throw new DomainError("Angre avlysningen før du redigerer øktplanen.");
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
    const [latest] = await tx.select().from(sessionVersions)
      .where(eq(sessionVersions.eventId, eventId)).orderBy(desc(sessionVersions.version)).limit(1);
    if (!latest) throw new DomainError("Økten mangler en planversjon. Kontakt administrator.");
    if (plan.coachIds) {
      const members = await sessionCoaches(tx, groupId);
      const allowed = new Set([...members.map((member) => member.userId), ...(latest.plan.coachIds ?? [])]);
      if (plan.coachIds.some((id) => !allowed.has(id))) throw new DomainError("Velg bare trenere som er medlemmer av laget.");
    }
    await tx.insert(sessionVersions).values({
      clubId: event.clubId, groupId, eventId, version: latest.version + 1, createdBy: userId, origin,
      eventSnapshot: { ...data, status }, plan, planningContext: await planningSnapshot(tx, userId, groupId, data.date),
    });
    await tx.update(trainingEvents).set({ ...data, status, planDeletedAt: null, revision: event.revision + 1 }).where(eq(trainingEvents.id, eventId));
    await writeHistory(tx, {
      clubId: event.clubId, groupId, planYear: Number(data.date.slice(0, 4)), entityType: "session", entityId: eventId,
      action: event.planDeletedAt ? "created" : event.status === status ? "updated" : "status_changed",
      actorType: origin === "ai" ? "ai" : "user", actorId: userId,
      beforeSnapshot: event.planDeletedAt ? null : sessionSnapshot(event, latest.plan),
      afterSnapshot: sessionSnapshot({ ...data, status }, plan),
    });
  });
}

export async function saveSessionFocus(db: Database, userId: string, groupId: string, eventId: string, revision: unknown, input: unknown) {
  const focus = z.object({ theme: z.string().trim().min(2).max(150), objectives: z.string().trim().min(1).max(8000) }).parse(input);
  const details = await trainingEventDetails(db, userId, groupId, eventId);
  if (details.event.planDeletedAt) throw new DomainError("Opprett en øktplan før du låser øktfokuset.");
  await saveSessionPlan(db, userId, groupId, eventId, { ...details.event, ...focus }, details.versions[0].plan, revision, "draft");
}

export async function deleteSessionPlan(db: Database, userId: string, groupId: string, eventId: string, revision: unknown) {
  idSchema.parse(eventId);
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [event] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
    if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
    assertRevision(event.revision, revision);
    if (event.planDeletedAt) throw new DomainError("Øktplanen er allerede slettet.");
    const [latest] = await tx.select().from(sessionVersions).where(eq(sessionVersions.eventId, eventId))
      .orderBy(desc(sessionVersions.version)).limit(1);
    if (!latest) throw new DomainError("Økten har ingen øktplan å slette.");
    await tx.update(trainingEvents).set({
      theme: "", objectives: "", status: "draft", planDeletedAt: new Date(), revision: event.revision + 1,
    }).where(eq(trainingEvents.id, eventId));
    await writeHistory(tx, {
      clubId: event.clubId, groupId, planYear: Number(event.date.slice(0, 4)), entityType: "session", entityId: eventId,
      action: "deleted", actorType: "user", actorId: userId,
      beforeSnapshot: sessionSnapshot(event, latest.plan, event.cancelledAt !== null), afterSnapshot: null,
    });
  });
}

export async function setTrainingCancellation(
  db: Database, userId: string, groupId: string, eventId: string, revision: unknown, cancelled: boolean,
) {
  idSchema.parse(eventId);
  z.boolean().parse(cancelled);
  await db.transaction(async (tx) => {
    await lockGroup(tx, userId, groupId);
    const [event] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
    if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
    assertRevision(event.revision, revision);
    if (Boolean(event.cancelledAt) === cancelled) return;
    const [latest] = await tx.select().from(sessionVersions).where(eq(sessionVersions.eventId, eventId))
      .orderBy(desc(sessionVersions.version)).limit(1);
    const plan = event.planDeletedAt ? null : latest?.plan ?? null;
    const cancelledAt = cancelled ? new Date() : null;
    await tx.update(trainingEvents).set({ cancelledAt, revision: event.revision + 1 }).where(eq(trainingEvents.id, eventId));
    await writeHistory(tx, {
      clubId: event.clubId, groupId, planYear: Number(event.date.slice(0, 4)), entityType: "session", entityId: eventId,
      action: "status_changed", actorType: "user", actorId: userId,
      beforeSnapshot: sessionSnapshot(event, plan, event.cancelledAt !== null),
      afterSnapshot: sessionSnapshot(event, plan, cancelledAt !== null),
    });
  });
}
