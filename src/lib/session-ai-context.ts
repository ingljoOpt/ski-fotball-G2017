import { and, desc, eq, lt, ne, or, sql } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { sessionVersions, trainingEvents } from "../db/schema.ts";
import { DomainError } from "./domain.ts";
import { annualPlanning, trainingEventDetails } from "./planning-domain.ts";
import { eventsDuring, nffAgeSource, periodsOnDate, type Exercise } from "./planning.ts";
import type { AIDraft } from "./session-ai.ts";

function exerciseSummary(exercise: Exercise) {
  return { ...exercise, description: exercise.description.slice(0, 1200), organization: exercise.organization.slice(0, 1200),
    objectives: exercise.objectives.slice(0, 800), coachingPoints: exercise.coachingPoints.slice(0, 800),
    easier: exercise.easier.slice(0, 500), harder: exercise.harder.slice(0, 500), localAdaptations: exercise.localAdaptations.slice(0, 500) };
}

export async function sessionAIContext(db: Database, userId: string, groupId: string, eventId: string, revision: number, draft: AIDraft) {
  const details = await trainingEventDetails(db, userId, groupId, eventId);
  if (details.event.revision !== revision) throw new DomainError("Økten er endret av en annen trener. Last siden på nytt før du bruker AI.");
  if (details.event.status === "cancelled") throw new DomainError("Gjenåpne økten før du bruker AI.");
  const year = Number(draft.event.date.slice(0, 4));
  const annual = await annualPlanning(db, userId, groupId, year);
  const history = await db.select({
    event: trainingEvents, plan: sessionVersions.plan,
  }).from(trainingEvents).innerJoin(sessionVersions, and(
    eq(sessionVersions.eventId, trainingEvents.id), eq(sessionVersions.groupId, groupId),
    sql`${sessionVersions.version} = (select max(v.version) from session_versions v where v.event_id = ${trainingEvents.id})`,
  )).where(and(eq(trainingEvents.groupId, groupId), ne(trainingEvents.id, eventId),
    or(lt(trainingEvents.date, draft.event.date), and(eq(trainingEvents.date, draft.event.date), lt(trainingEvents.startTime, draft.event.startTime))),
    ne(trainingEvents.status, "cancelled")))
    .orderBy(desc(trainingEvents.date), desc(trainingEvents.startTime)).limit(5);
  const sources = [...draft.plan.exercises, ...history.flatMap((item) => item.plan.exercises)]
    .filter((exercise) => exercise.sourceUrl).map(({ sourceUrl, sourceAge, sourceCheckedOn }) => ({ sourceUrl, sourceAge, sourceCheckedOn }));
  return {
    draft,
    age: nffAgeSource(year, annual.group.birthYear),
    annualObjectives: annual.plan?.objectives ?? "",
    periods: periodsOnDate(annual.periods, draft.event.date).map(({ startDate, endDate, theme, objectives, progression, sourceUrl }) => ({
      startDate, endDate, theme, objectives, progression, sourceUrl,
    })),
    events: eventsDuring(annual.events, draft.event.date).map(({ title, kind, startDate, endDate, description }) => ({ title, kind, startDate, endDate, description })),
    history: history.map(({ event, plan }) => ({
      date: event.date, title: event.title, theme: event.theme, objectives: event.objectives,
      status: event.status, introduction: plan.introduction.slice(0, 1200),
      progression: plan.progression.slice(0, 1200), exercises: plan.exercises.slice(0, 10).map(exerciseSummary),
    })),
    sources,
    limitations: "Historikken er tidligere planer, ikke dokumentasjon på gjennomføring. Evalueringer, klubbfelles sportsplan/utstyr og nettleserkontroll av Tiim er ikke implementert. Kildedata er tidligere treneropplysninger, ikke ny kildekontroll.",
  };
}
