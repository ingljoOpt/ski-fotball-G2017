import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { sessionHistory, trainingEventDetails } from "@/lib/planning-domain";
import { deleteSessionPlanAction, setTrainingStatus } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { AppLink, Card, Chip, SubmitButton } from "@/app/ui";
import { eventStatusLabels, formatDate, PlanningNavigation } from "@/app/planning-components";
import { SessionPlanEditor } from "@/app/session-plan-editor";
import { SessionPlanView } from "@/app/session-plan-view";
import { SessionToolbar } from "@/app/session-toolbar";
import { PlanningHistory } from "@/app/planning-history";
import { coachSelectionChanged, emptySessionPlan, nffAgeSource } from "@/lib/planning";
import { formatTimeRange } from "@/lib/validation";
import { teamUrl } from "@/lib/slugs";
import { listSessionReviews } from "@/lib/session-review-domain";
import { sessionHasEnded } from "@/lib/session-review";
import { SessionReviewForm } from "@/app/session-review-form";

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
  const canReview = event.status !== "cancelled" && latest && sessionHasEnded(event);
  return <ClubTheme club={details.club} header>
    <Account email={user.email} />
    <PlanningNavigation basePath={basePath} year={Number(event.date.slice(0, 4))} />
    <div className="session-page">
    <SessionToolbar canEdit={event.status !== "cancelled"} />
    <Notices searchParams={searchParams} />
    <header className="session-heading">
      <span className="eyebrow">{details.group.name} · Økt</span><h1>{event.title}</h1>
      <div className="row"><p>{formatDate(event.date)} kl. {formatTimeRange(event.startTime, event.endTime)} · Europe/Oslo</p>
        <Chip>{eventStatusLabels[event.status]}</Chip></div>
      <small>{latest ? `Planversjon ${latest.version} · Oppdatert ${new Intl.DateTimeFormat("nb-NO", {
        dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo",
      }).format(latest.createdAt)}` : "Ingen aktiv øktplan"}</small>
    </header>
    {latest ? <SessionPlanView plan={latest.plan} coaches={details.coaches} durationMinutes={event.durationMinutes} theme={event.theme} objectives={event.objectives}
      ageLabel={context.birthYear === null ? "Årskull ikke oppgitt" : nffAgeSource(context.year, context.birthYear).label} />
      : <p className="notice">Ingen aktiv øktplan. Tidligere versjoner er bevart i revisjonshistorikken.</p>}
    <section className="session-administration" aria-label="Evaluering av økten">
      <Card className="app-card"><h2>Evaluering av gjennomført økt</h2>
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
        {canReview && reviewVersion ? <details className="plan-editor-details">
          <summary>{ownReview ? "Rediger min evaluering" : "Evaluer økten"}</summary>
          <p>Planversjon {reviewVersion.version}</p>
          <SessionReviewForm key={`${event.revision}-${ownReview?.revision ?? 0}-${reviewVersion.id}`} groupId={groupId} eventId={eventId}
            eventRevision={event.revision} versionId={reviewVersion.id} exercises={reviewVersion.plan.exercises}
            review={ownReview?.review} reviewRevision={ownReview?.revision ?? 0} />
        </details> : <p className="muted">Evaluering er tilgjengelig etter at en aktiv økt er avsluttet.</p>}
      </Card>
    </section>
    <div className="session-administration">
        {event.status !== "cancelled" ? <Card className="app-card">
          <details id="rediger-okt" open={!latest || latest.plan.exercises.length === 0 || coachSelectionChanged(latest.plan)} className="plan-editor-details">
            <summary><h2>Rediger øktplanen</h2></summary>
            <SessionPlanEditor key={event.revision} groupId={groupId} eventId={eventId} revision={event.revision} initialEvent={event}
              coaches={details.coaches} initialPlan={latest?.plan ?? { ...emptySessionPlan(), coachIds: latestVersion.plan.coachIds, confirmedCoaches: latestVersion.plan.confirmedCoaches }} initialDraft={query.initialDraft === "1"} />
          </details>
        </Card> : <p className="notice">Økten er avlyst. Planen beholdes. Angre avlysningen for å redigere øktplanen.</p>}
    </div>
    <div className="columns session-administration">
      <section className="stack">
        <Card className="app-card"><details className="plan-editor-details"><summary><h2>Planversjoner</h2></summary>
          <p>Dato, tema, rammer og årsplankontekst er bevart per versjon. Endringer i årsplanen endrer ikke lagrede økter.</p>
          {versions.map((version) => <details className="exercise-detail" key={version.id}>
            <summary>Versjon {version.version} · {version.origin === "manual" ? "Manuell" : "AI-assistert"} · {new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo" }).format(version.createdAt)}</summary>
            <h3>{version.eventSnapshot.title}</h3>
            <p>{formatDate(version.eventSnapshot.date)} kl. {formatTimeRange(version.eventSnapshot.startTime, version.eventSnapshot.endTime)} · {version.eventSnapshot.theme || "Tema ikke satt"} · {eventStatusLabels[version.eventSnapshot.status]}</p>
            <p className="preserve-lines">{version.eventSnapshot.objectives}</p>
            <p>Årsplankontekst: {version.planningContext.periods.map((period) => period.theme).join(", ") || "Ingen temaperiode"}</p>
            <SessionPlanView plan={version.plan} coaches={details.coaches} durationMinutes={version.eventSnapshot.durationMinutes} idPrefix={`versjon-${version.id}`} showLegacy />
          </details>)}
        </details></Card>
      </section>
      <section className="stack">
        <Card className="app-card"><h2>Øktplan</h2>
          {latest ? <>
            <p>Sletting fjerner planen fra økten, men lar treningstidspunktet og tidligere revisjoner stå.</p>
            <form action={deleteSessionPlanAction}>
              <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="revision" value={event.revision} />
              <SubmitButton variant="danger-soft">Slett øktplan</SubmitButton>
            </form>
          </> : <p>Ingen aktiv øktplan. Treningen kan fortsatt avlyses eller få en ny plan.</p>}
        </Card>
        <Card className="app-card"><h2>Årsplan som kontekst</h2>
          <p className="preserve-lines">{context.annualObjectives || "Ingen årsmål registrert."}</p>
          {context.periods.map((period) => <div key={period.id}><h3>{period.theme}</h3><p className="preserve-lines">{period.objectives}</p><p className="preserve-lines">{period.progression}</p></div>)}
          <AppLink href={`${basePath}/aarsplan?year=${context.year}`}>Åpne årsplan →</AppLink>
          <p className="notice">Øktassistenten bruker trenerføringer, årsplan, NFF-fagplan, hendelser og tidligere planer med evalueringer. AI-forslag må kontrolleres og lagres av treneren.</p>
        </Card>
        <Card className="app-card"><h2>Øktstatus</h2>
          <form action={setTrainingStatus}>
            <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="revision" value={event.revision} />
            <SubmitButton name="intent" value={event.status === "cancelled" ? "reopen" : "cancel"} variant={event.status === "cancelled" ? "secondary" : "danger-soft"}>
              {event.status === "cancelled" ? "Angre avlysning" : "Avlys økten"}
            </SubmitButton>
          </form>
          <small>Avlysning gjelder bare denne treningen. En plan er ikke dokumentasjon på gjennomføring.</small>
        </Card>
      </section>
    </div>
    <Card className="app-card"><PlanningHistory entries={history} /></Card>
    </div>
  </ClubTheme>;
}
