import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { sessionHistory, trainingEventDetails } from "@/lib/planning-domain";
import { deleteSessionPlanAction, setTrainingStatus } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { Card, SubmitButton } from "@/app/ui";
import { eventStatusLabels, formatDate, PlanningNavigation } from "@/app/planning-components";
import { SessionPlanEditor } from "@/app/session-plan-editor";
import { SessionHeading, SessionPlanView } from "@/app/session-plan-view";
import { SessionToolbar } from "@/app/session-toolbar";
import { PlanningHistory } from "@/app/planning-history";
import { emptySessionPlan, nffAgeSource } from "@/lib/planning";
import { formatTimeRange } from "@/lib/validation";
import { teamUrl } from "@/lib/slugs";
import { listSessionReviews } from "@/lib/session-review-domain";
import { sessionHasEnded } from "@/lib/session-review";
import { SessionReviewForm } from "@/app/session-review-form";
import { SessionAdvancedTabs } from "@/app/session-advanced-tabs";
import { listCustomExercises } from "@/lib/custom-exercise-domain";
import { getExerciseTopics } from "@/lib/nff-curriculum";

export default async function TrainingSession({ params, searchParams }: {
  params: Promise<{ groupId: string; eventId: string }>; searchParams: SearchParams;
}) {
  const user = await requireUser();
  const [{ groupId, eventId }, query] = await Promise.all([params, searchParams]);
  let details;
  let history;
  let reviews;
  const db = await getDatabase();
  try {
    details = await trainingEventDetails(db, user.id, groupId, eventId);
    history = await sessionHistory(db, user.id, groupId, eventId);
    reviews = await listSessionReviews(db, user.id, groupId, eventId);
  }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const { event, versions, context } = details;
  const basePath = teamUrl(details.club, details.group);
  const latestVersion = versions[0];
  const latest = event.planDeletedAt ? null : latestVersion;
  const ownReview = reviews.find((review) => review.authorId === user.id);
  const reviewVersion = ownReview ? versions.find((version) => version.id === ownReview.versionId) : latest;
  const ended = sessionHasEnded(event);
  const canReview = event.status !== "cancelled" && latest && ended;
  const canEdit = event.status !== "cancelled" && !ended;
  const [ownExercises, topics] = canEdit ? await Promise.all([listCustomExercises(db, user.id, groupId), getExerciseTopics()]) : [[], []];
  const ageLabel = context.birthYear === null ? "Årskull ikke oppgitt" : nffAgeSource(context.year, context.birthYear).label;
  const versionLabel = latest ? `Planversjon ${latest.version} · Oppdatert ${new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo",
  }).format(latest.createdAt)}` : "Ingen aktiv øktplan";
  return <ClubTheme club={details.club} header>
    <Account email={user.email} />
    <PlanningNavigation basePath={basePath} year={Number(event.date.slice(0, 4))} />
    <div className="session-page">
    <Notices searchParams={searchParams} />
    {canEdit ? <SessionPlanEditor key={event.revision} groupId={groupId} eventId={eventId} revision={event.revision} initialEvent={event}
      groupName={details.group.name} statusLabel={eventStatusLabels[event.status]} versionLabel={versionLabel}
      coaches={details.coaches} ageLabel={ageLabel} basePath={basePath} ownExercises={ownExercises} topics={topics} initialPlan={latest?.plan ?? { ...emptySessionPlan(), coachIds: latestVersion?.plan.coachIds, expectedPlayers: latestVersion?.plan.expectedPlayers ?? null, confirmedCoaches: latestVersion?.plan.confirmedCoaches ?? null }}
      initialDraft={query.initialDraft === "1" && (!latest || (latest.version === 1 && latest.plan.exercises.length === 0))} />
      : <><SessionToolbar /><SessionHeading groupName={details.group.name} event={event} status={eventStatusLabels[event.status]} version={versionLabel} />
        {latest ? <SessionPlanView plan={latest.plan} coaches={details.coaches} durationMinutes={event.durationMinutes} theme={event.theme} objectives={event.objectives}
          ageLabel={ageLabel} /> : <p className="notice">Ingen aktiv øktplan.</p>}</>}
    {ended && (canReview || reviews.length > 0) && <section className="session-administration" aria-label="Evaluering av økten">
      <Card className="app-card"><h2>Evaluering av økten</h2>
        {reviews.map((item) => {
          const version = versions.find((entry) => entry.id === item.versionId);
          return <details className="exercise-detail" key={item.id}>
            <summary>{item.authorEmail} · Planversjon {version?.version ?? "ukjent"}</summary>
            {item.review.exercises.map((exercise) => <div key={exercise.exerciseId}>
              <strong>{version?.plan.exercises.find((entry) => entry.id === exercise.exerciseId)?.title ?? "Øvelse"}</strong>
              {exercise.rating !== null && <span> · {exercise.rating} av 5</span>}
              {exercise.comment && <p className="preserve-lines">{exercise.comment}</p>}
            </div>)}
            {item.review.comment && <p className="preserve-lines">{item.review.comment}</p>}
          </details>;
        })}
        {canReview && reviewVersion ? <details open className="plan-editor-details">
          <summary>{ownReview ? "Rediger min evaluering" : "Evaluer økten"}</summary>
          <p>Planversjon {reviewVersion.version}</p>
          <SessionReviewForm key={`${event.revision}-${ownReview?.revision ?? 0}-${reviewVersion.id}`} groupId={groupId} eventId={eventId}
            eventRevision={event.revision} versionId={reviewVersion.id} exercises={reviewVersion.plan.exercises}
            review={ownReview?.review} reviewRevision={ownReview?.revision ?? 0} />
        </details> : null}
      </Card>
    </section>}
    {!ended && event.status === "cancelled" && <p className="notice">Økten er avlyst. Planen beholdes. Angre avlysningen for å redigere øktplanen.</p>}
    {!ended && <details className="session-administration session-advanced">
      <summary>Avansert</summary>
      <SessionAdvancedTabs tabs={[
        { id: "versions", label: "Planversjoner", content: <>
          <h2>Planversjoner</h2>
          <p>Dato, tema, rammer og årsplankontekst er bevart per versjon. Endringer i årsplanen endrer ikke lagrede økter.</p>
          {!versions.length && <p className="muted">Ingen planversjoner er lagret ennå.</p>}
          {versions.map((version) => <details className="exercise-detail" key={version.id}>
            <summary>Versjon {version.version} · {version.origin === "manual" ? "Manuell" : "AI-assistert"} · {new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo" }).format(version.createdAt)}</summary>
            <h3>{version.eventSnapshot.title}</h3>
            <p>{formatDate(version.eventSnapshot.date)} kl. {formatTimeRange(version.eventSnapshot.startTime, version.eventSnapshot.endTime)} · {version.eventSnapshot.theme || "Tema ikke satt"} · {eventStatusLabels[version.eventSnapshot.status]}</p>
            <p className="preserve-lines">{version.eventSnapshot.objectives}</p>
            <p>Årsplankontekst: {version.planningContext.periods.map((period) => period.theme).join(", ") || "Ingen temaperiode"}</p>
            <SessionPlanView plan={version.plan} coaches={details.coaches} durationMinutes={version.eventSnapshot.durationMinutes} theme={version.eventSnapshot.theme} idPrefix={`versjon-${version.id}`} showLegacy />
          </details>)}
        </> },
        { id: "delete", label: "Slett øktplan", content: <><h2>Slett øktplan</h2>
          {latest ? <>
            <p>Sletting fjerner planen fra økten, men lar treningstidspunktet og tidligere revisjoner stå.</p>
            <form action={deleteSessionPlanAction}>
              <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="revision" value={event.revision} />
              <SubmitButton variant="danger-soft">Slett øktplan</SubmitButton>
            </form>
          </> : <p>Ingen aktiv øktplan. Treningen kan fortsatt avlyses eller få en ny plan.</p>}
        </> },
        { id: "status", label: event.status === "cancelled" ? "Angre avlysning" : "Avlys økten", content: <><h2>Øktstatus</h2>
          <form action={setTrainingStatus}>
            <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="revision" value={event.revision} />
            <SubmitButton name="intent" value={event.status === "cancelled" ? "reopen" : "cancel"} variant={event.status === "cancelled" ? "secondary" : "danger-soft"}>
              {event.status === "cancelled" ? "Angre avlysning" : "Avlys økten"}
            </SubmitButton>
          </form>
          <small>Avlysning gjelder bare denne treningen. En plan er ikke dokumentasjon på gjennomføring.</small>
        </> },
        { id: "history", label: "Endringshistorikk", content: <PlanningHistory entries={history} /> },
      ]} />
    </details>}
    </div>
  </ClubTheme>;
}
