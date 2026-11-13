import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import { clubDocuments, groups, sessionReviews, sessionVersions, trainingEvents } from "../db/schema.ts";
import { DomainError } from "./domain.ts";
import { annualPlanning, trainingEventDetails } from "./planning-domain.ts";
import { eventsDuring, nffAgeSource, periodsOnDate, themeSuggestionOnDate, type Exercise } from "./planning.ts";
import type { AIDraft } from "./session-ai.ts";
import { getNffCurriculum, relevantCurriculum } from "./nff-curriculum.ts";
import { planningPrioritiesSchema, priorityLabels } from "./planning-priorities.ts";

function exerciseSummary(exercise: Exercise) {
  return { ...exercise, description: exercise.description.slice(0, 1200), organization: exercise.organization.slice(0, 1200),
    objectives: exercise.objectives.slice(0, 800), coachingPoints: exercise.coachingPoints.slice(0, 800),
    easier: exercise.easier.slice(0, 500), harder: exercise.harder.slice(0, 500), localAdaptations: exercise.localAdaptations.slice(0, 500) };
}

export async function sessionAIContext(db: Database, userId: string, groupId: string, eventId: string, revision: number, draft: AIDraft,
  curriculumReader = getNffCurriculum) {
  const details = await trainingEventDetails(db, userId, groupId, eventId);
  if (details.event.revision !== revision) throw new DomainError("Økten er endret av en annen trener. Last siden på nytt før du bruker AI.");
  if (details.event.cancelledAt) throw new DomainError("Angre avlysningen før du bruker AI.");
  return buildSessionAIContext(db, userId, groupId, eventId, draft, details.event.coachInput, curriculumReader);
}

export async function scheduledSessionAIContext(db: Database, userId: string, groupId: string, draft: AIDraft,
  curriculumReader = getNffCurriculum) {
  return buildSessionAIContext(db, userId, groupId, null, draft, "", curriculumReader);
}

async function buildSessionAIContext(db: Database, userId: string, groupId: string, eventId: string | null, draft: AIDraft,
  input: string, curriculumReader: typeof getNffCurriculum) {
  const year = Number(draft.event.date.slice(0, 4));
  const annual = await annualPlanning(db, userId, groupId, year);
  const priorities = planningPrioritiesSchema.parse(annual.group.aiPriorities);
  const history = await db.select({
    event: trainingEvents, plan: sessionVersions.plan,
  }).from(trainingEvents).innerJoin(sessionVersions, and(
    eq(sessionVersions.eventId, trainingEvents.id), eq(sessionVersions.groupId, groupId),
    sql`${sessionVersions.version} = (select max(v.version) from session_versions v where v.event_id = ${trainingEvents.id})`,
  )).where(and(eq(trainingEvents.groupId, groupId), eventId ? ne(trainingEvents.id, eventId) : undefined,
    or(lt(trainingEvents.date, draft.event.date), and(eq(trainingEvents.date, draft.event.date), lt(trainingEvents.startTime, draft.event.startTime))),
    isNull(trainingEvents.cancelledAt)))
    .orderBy(desc(trainingEvents.date), desc(trainingEvents.startTime)).limit(5);
  const clubHistory = annual.group.birthYear === null ? [] : await db.select({ event: trainingEvents, plan: sessionVersions.plan })
    .from(trainingEvents).innerJoin(groups, eq(groups.id, trainingEvents.groupId))
    .innerJoin(sessionVersions, and(eq(sessionVersions.eventId, trainingEvents.id),
      sql`${sessionVersions.version} = (select max(v.version) from session_versions v where v.event_id = ${trainingEvents.id})`))
    .where(and(eq(groups.clubId, annual.group.clubId), ne(groups.id, groupId), lt(trainingEvents.date, `${year}-01-01`), isNull(trainingEvents.cancelledAt),
      sql`${sessionVersions.planningContext}->>'birthYear' = ${String(annual.group.birthYear)}`,
      ...(annual.isAdmin ? [] : [sql`exists (select 1 from group_members member where member.group_id = ${groups.id} and member.user_id = ${userId})`])))
    .orderBy(desc(trainingEvents.date), desc(trainingEvents.startTime)).limit(3);
  const exercises = [...draft.plan.exercises, ...history.flatMap((item) => item.plan.exercises), ...clubHistory.flatMap((item) => item.plan.exercises)];
  const sources = exercises
    .filter((exercise) => exercise.sourceUrl).map(({ sourceUrl, sourceAge, sourceCheckedOn }) => ({ sourceUrl, sourceAge, sourceCheckedOn }));
  const age = nffAgeSource(year, annual.group.birthYear);
  const periods = periodsOnDate(annual.periods, draft.event.date);
  const fullCurriculum = await curriculumReader(age.age);
  const suggestedPeriod = !draft.event.theme.trim() ? themeSuggestionOnDate(draft.event.date, annual.periods, fullCurriculum.topics) ?? null : null;
  const curriculum = relevantCurriculum(fullCurriculum, [draft.event.theme, draft.event.objectives, suggestedPeriod?.theme ?? "",
    annual.plan?.objectives ?? "", ...periods.flatMap((period) => [period.theme, period.objectives, period.coachMoments ?? ""])]);
  const evaluations = history.length ? await db.select({ eventId: sessionReviews.eventId, review: sessionReviews.review,
    version: sessionVersions.version, plan: sessionVersions.plan })
    .from(sessionReviews).innerJoin(sessionVersions, eq(sessionVersions.id, sessionReviews.versionId))
    .innerJoin(trainingEvents, eq(trainingEvents.id, sessionReviews.eventId))
    .where(and(eq(sessionReviews.groupId, groupId), inArray(sessionReviews.eventId, history.map(({ event }) => event.id))))
    .orderBy(desc(trainingEvents.date), desc(trainingEvents.startTime), desc(sessionReviews.updatedAt)).limit(25) : [];
  const historicalPlans = history.map(({ event, plan }) => ({
    date: event.date, title: event.title, theme: event.theme, objectives: event.objectives,
    status: event.status, introduction: plan.introduction.slice(0, 1200),
    progression: plan.progression.slice(0, 1200), exercises: plan.exercises.slice(0, 10).map(exerciseSummary),
    evaluations: evaluations.filter((item) => item.eventId === event.id).slice(0, 5).map(({ review, version, plan: reviewedPlan }) => ({
      planVersion: version, comment: review.comment.slice(0, 800),
      exercises: review.exercises.slice(0, 10).map((exercise) => ({ exerciseId: exercise.exerciseId,
        title: reviewedPlan.exercises.find((item) => item.id === exercise.exerciseId)?.title ?? "Øvelse",
        rating: exercise.rating, comment: exercise.comment.slice(0, 500) })),
    })),
  }));
  const cohortPlans = clubHistory.map(({ event, plan }) => ({ date: event.date, title: event.title, theme: event.theme, objectives: event.objectives,
    progression: plan.progression.slice(0, 1200), exercises: plan.exercises.slice(0, 10).map(exerciseSummary) }));
  const tiimExercises = exercises.filter((exercise) => exercise.sourceUrl && new URL(exercise.sourceUrl).hostname === "tiim.no").slice(0, 12).map(exerciseSummary);
  const guidelines = await db.select({ name: clubDocuments.name, text: clubDocuments.extractedText })
    .from(clubDocuments).where(and(eq(clubDocuments.clubId, annual.group.clubId), isNull(clubDocuments.archivedAt)))
    .orderBy(clubDocuments.createdAt);
  const sourceData = {
    club_guidelines: guidelines.length
      ? { status: "available", contextFields: ["clubGuidelines"], reason: "Aktive klubbdokumenter med uttrukket tekst." }
      : { status: "unavailable", reason: "Klubbens retningslinjer og sportsplan er ikke registrert i appen." },
    period_focus: { status: periods.length ? "available" : "partial", contextFields: ["periods", "suggestedPeriod", "annualObjectives", "curriculum"], reason: periods.length ? "Periodene er lagret og låst av trener." : "Ingen låst temaperiode på øktdatoen. Et eventuelt temaforslag er ikke en trenerføring." },
    coach_input: { status: input || annual.group.generalInstructions ? "available" : "unavailable", data: input, contextFields: ["coachInput", "teamInstructions"],
      reason: input || annual.group.generalInstructions ? "Lagets generelle instrukser og eventuelle innspill ved manuell oppretting." : "Ingen laginstrukser eller særskilte trenerinnspill registrert." },
    previous_evaluations: { status: historicalPlans.length ? historicalPlans.every((item) => item.evaluations.length) ? "available" : "partial" : "unavailable",
      contextFields: ["history", "previousPlan"], reason: evaluations.length ? "Trenerregistrerte evalueringer fra samme lag; manglende evaluering er ikke dokumentert gjennomføring." : "Tidligere planer kan finnes, men ingen evalueringer er registrert for disse øktene." },
    club_cohort_history: { status: cohortPlans.length ? "partial" : "unavailable", contextFields: ["clubCohortHistory"], reason: "Bare tidligere års planer for samme dokumenterte årskull og lag brukeren har tilgang til. Evalueringer fra andre lag tas ikke med." },
    tiim_exercises: { status: tiimExercises.length ? "partial" : "unavailable", contextFields: ["tiimExercises"], reason: "Tidligere oppgitte Tiim-øvelser og kildefelt. Nytt søk og kildekontroll rapporteres separat av findTiimExercises." },
  };
  return {
    priorities,
    prioritySources: priorities.map((id) => ({ id, label: priorityLabels[id], ...sourceData[id] })),
    coachInput: input,
    teamInstructions: annual.group.generalInstructions,
    differentiation: annual.group.differentiation.enabled ? {
      settings: annual.group.differentiation,
      teamPlayers: annual.group.differentiation.levels.reduce((sum, level) => sum + level.players, 0),
      sessionPlayers: draft.plan.expectedPlayers,
      sessionCoaches: draft.plan.confirmedCoaches,
    } : null,
    clubGuidelines: guidelines,
    clubCohortHistory: cohortPlans,
    previousPlan: historicalPlans.length ? historicalPlans[0] : null,
    tiimExercises,
    draft,
    age,
    curriculum,
    annualObjectives: annual.plan?.objectives ?? "",
    suggestedPeriod,
    periods: periods.map(({ startDate, endDate, theme, objectives, coachMoments, progression, sourceUrl }) => ({
      startDate, endDate, theme, objectives, coachMoments, progression, sourceUrl,
    })),
    events: eventsDuring(annual.events, draft.event.date).map(({ title, kind, startDate, endDate, description }) => ({ title, kind, startDate, endDate, description })),
    history: historicalPlans,
    sources,
    limitations: "Historikken er tidligere planer, ikke dokumentasjon på gjennomføring. Evalueringer er trenernes vurderinger av angitte planversjoner, ikke bekreftet oppmøte eller fullstendig gjennomføring. Klubbfelles utstyr er ikke implementert. Dokumenttekst er maskinelt hentet ut og kan mangle formatering, bilder eller innhold. NFF-fagplan er hentet som faglig støtte med hentetidspunkt og eventuelle kildeadvarsler, ikke kontroll av konkrete øvelser. Tidligere øvelsers kildedata er treneropplysninger, ikke ny kildekontroll; se eget Tiim-søk for nye kontroller.",
  };
}
