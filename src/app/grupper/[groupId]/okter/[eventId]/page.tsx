import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { trainingEventDetails } from "@/lib/planning-domain";
import { setTrainingStatus } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubIdentity, ClubTheme } from "@/app/club-theme";
import { AppLink, Card, Chip, SubmitButton } from "@/app/ui";
import { eventStatusLabels, formatDate, PlanningNavigation } from "@/app/planning-components";
import { SessionPlanEditor } from "@/app/session-plan-editor";
import { SessionPlanView } from "@/app/session-plan-view";
import { formatTimeRange } from "@/lib/validation";

export default async function TrainingSession({ params, searchParams }: {
  params: Promise<{ groupId: string; eventId: string }>; searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { groupId, eventId } = await params;
  let details;
  try { details = await trainingEventDetails(await getDatabase(), user.id, groupId, eventId); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const { event, versions, context } = details;
  const latest = versions[0];
  return <ClubTheme club={details.club}>
    <Account email={user.email} /><ClubIdentity club={details.club} />
    <PlanningNavigation groupId={groupId} year={Number(event.date.slice(0, 4))} />
    <span className="eyebrow">{details.group.name} · Øktplan</span><h1>{event.title}</h1>
    <div className="row"><p>{formatDate(event.date)} kl. {formatTimeRange(event.startTime, event.endTime)} · Europe/Oslo · {event.durationMinutes} minutter</p>
      <Chip>{eventStatusLabels[event.status]}</Chip></div>
    <Notices searchParams={searchParams} />
    <Card className="app-card">
      <h2>{event.theme || "Tema er ikke satt"}</h2><p className="preserve-lines">{event.objectives || "Øvingsmål er ikke satt."}</p>
      <SessionPlanView plan={latest.plan} durationMinutes={event.durationMinutes} />
    </Card>
    <div className="columns">
      <section className="stack">
        {event.status !== "cancelled" ? <Card className="app-card">
          <details open={latest.plan.exercises.length === 0} className="plan-editor-details">
            <summary><h2>Rediger øktplanen</h2></summary>
            <SessionPlanEditor key={event.revision} groupId={groupId} eventId={eventId} revision={event.revision} initialEvent={event} initialPlan={latest.plan} />
          </details>
        </Card> : <p className="notice">Økten er avlyst. Plan og versjonshistorikk beholdes. Gjenåpne som utkast for å redigere.</p>}
        <Card className="app-card"><h2>Planversjoner</h2>
          <p>Dato, tema, rammer og årsplankontekst er bevart per versjon. Endringer i årsplanen endrer ikke lagrede økter.</p>
          {versions.map((version) => <details className="exercise-detail" key={version.id}>
            <summary>Versjon {version.version} · {version.origin === "manual" ? "Manuell" : "AI-utkast"} · {new Intl.DateTimeFormat("nb-NO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo" }).format(version.createdAt)}</summary>
            <h3>{version.eventSnapshot.title}</h3>
            <p>{formatDate(version.eventSnapshot.date)} kl. {formatTimeRange(version.eventSnapshot.startTime, version.eventSnapshot.endTime)} · {version.eventSnapshot.theme || "Tema ikke satt"} · {eventStatusLabels[version.eventSnapshot.status]}</p>
            <p className="preserve-lines">{version.eventSnapshot.objectives}</p>
            <p>Årsplankontekst: {version.planningContext.periods.map((period) => period.theme).join(", ") || "Ingen temaperiode"}</p>
            <SessionPlanView plan={version.plan} durationMinutes={version.eventSnapshot.durationMinutes} />
          </details>)}
        </Card>
      </section>
      <section className="stack">
        <Card className="app-card"><h2>Årsplan som kontekst</h2>
          <p className="preserve-lines">{context.annualObjectives || "Ingen årsmål registrert."}</p>
          {context.periods.map((period) => <div key={period.id}><h3>{period.theme}</h3><p className="preserve-lines">{period.objectives}</p><p className="preserve-lines">{period.progression}</p></div>)}
          <AppLink href={`/grupper/${groupId}/arsplan?year=${context.year}`}>Åpne årsplan →</AppLink>
          <p className="notice">Manuell planlegging er aktiv. AI-generering og aldersriktige NFF-temaforslag kommer i steg 4. Årsplan, øktdata og kildefelt er tilrettelagt.</p>
        </Card>
        <Card className="app-card"><h2>Øktstatus</h2>
          <form action={setTrainingStatus}>
            <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="revision" value={event.revision} />
            <SubmitButton name="intent" value={event.status === "cancelled" ? "reopen" : "cancel"} variant={event.status === "cancelled" ? "secondary" : "danger-soft"}>
              {event.status === "cancelled" ? "Gjenåpne som utkast" : "Avlys økten"}
            </SubmitButton>
          </form>
          <small>Avlysning gjelder bare denne treningen. Faktisk gjennomføring og evaluering kommer i et eget steg, og er aldri utledet fra en plan.</small>
        </Card>
      </section>
    </div>
  </ClubTheme>;
}
