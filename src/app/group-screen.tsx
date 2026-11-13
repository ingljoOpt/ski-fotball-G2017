import { AppLink, Card, MemberSelect, NativeInput, SubmitButton, TextAreaInput } from "@/app/ui";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { generationJobs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { DomainError, groupDetails } from "@/lib/domain";
import { changeHeadCoach, deleteTeamCoach, deleteTrainingTime, newCoachInvitation, newTrainingEvent, saveGroupSettings } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { generationDate, nffAgeSource, osloToday, periodsOnDate, themeSuggestionOnDate } from "@/lib/planning";
import { annualPlanning, groupSessions } from "@/lib/planning-domain";
import { getNffCurriculum } from "@/lib/nff-curriculum";
import { eventStatusLabels, formatDate, PlanningNavigation } from "@/app/planning-components";
import { formatTimeRange } from "@/lib/validation";
import { clubUrl, teamUrl } from "@/lib/slugs";
import { PlanningPrioritiesEditor } from "@/app/planning-priorities-editor";
import { AutomaticPlanSettings } from "@/app/automatic-plan-settings";
import { DifferentiationSettings } from "@/app/differentiation-settings";
import { Trash2 } from "lucide-react";
import { NewTrainingTimeDialog } from "@/app/new-training-time-dialog";
import { CoachDialog } from "@/app/coach-dialog";

const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const roleName = (role: string) => role === "head_coach" ? "Hovedtrener" : "Trener";

export async function GroupScreen({ params, searchParams, section = "oversikt" }: {
  params: Promise<{ groupId: string }>; searchParams: SearchParams; section?: "oversikt" | "brukere" | "innstillinger";
}) {
  const user = await requireUser();
  const { groupId } = await params;
  let details;
  try {
    details = await groupDetails(await getDatabase(), user.id, groupId);
  } catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const { group, canManage } = details;
  const basePath = teamUrl(details.club, group);
  const sessions = section === "oversikt" ? await groupSessions(await getDatabase(), user.id, groupId) : null;
  const upcoming = sessions?.upcoming;
  const missingPlan = upcoming && (upcoming.virtual || upcoming.status === "no_plan");
  const planning = missingPlan ? await annualPlanning(await getDatabase(), user.id, groupId, Number(upcoming.date.slice(0, 4))) : null;
  const lockedPeriod = planning && upcoming ? periodsOnDate(planning.periods, upcoming.date)[0] : undefined;
  const curriculum = planning && upcoming && !lockedPeriod
    ? await getNffCurriculum(nffAgeSource(Number(upcoming.date.slice(0, 4)), group.birthYear).age) : null;
  const suggestion = planning && upcoming && curriculum ? themeSuggestionOnDate(upcoming.date, planning.periods, curriculum.topics) : undefined;
  const automatic = process.env.VERCEL_ENV === "production" && group.autoDraftEnabled;
  const [failedJob] = automatic && (upcoming?.virtual || upcoming?.status === "no_plan") ? await (await getDatabase()).select({ id: generationJobs.id }).from(generationJobs)
    .where(and(eq(generationJobs.groupId, groupId), eq(generationJobs.date, upcoming.date),
      eq(generationJobs.startTime, upcoming.startTime), eq(generationJobs.status, "failed"))).limit(1) : [];
  return (
    <ClubTheme club={details.club} header>
      <Account email={user.email} />
      <AppLink className="back" href={clubUrl(details.club)}>← Til klubben</AppLink>
      <span className="eyebrow">{section === "oversikt" ? "Lagets trenerrom" : group.name}</span>
      <h1>{section === "oversikt" ? `Økter · ${group.name}` : section === "brukere" ? "Trenere og brukere" : "Laginnstillinger"}</h1>
      <PlanningNavigation basePath={basePath} year={Number(osloToday().slice(0, 4))} />
      <Notices searchParams={searchParams} />
      {section === "oversikt" && <div className="page-content">
        <div className="row"><AppLink href={`${basePath}/okter/ny`}>+ Opprett økt manuelt</AppLink>
          <AppLink href={`${basePath}/aarsplan`}>Se treninger og hendelser i årsplanen →</AppLink></div>
        <Card className="app-card"><h2>Kommende økt</h2>
          {automatic && !details.members.some((member) => member.role === "head_coach") && <p className="notice error">Automatisk planlegging krever en aktiv hovedtrener på laget.</p>}
          {upcoming ? <>
            <p><strong>{formatDate(upcoming.date)} kl. {formatTimeRange(upcoming.startTime, upcoming.endTime)}</strong></p>
            <h3>{upcoming.title}</h3><p>{upcoming.theme || lockedPeriod?.theme || "Tema ikke satt"} · {upcoming.durationMinutes} minutter</p>
            {missingPlan && !lockedPeriod && <div className="annual-proposed-period">
              {suggestion ? <><strong>Foreslått tema: {suggestion.theme}</strong><p>Ikke låst. Forslaget brukes som utgangspunkt for AI-planlegging og kan endres.</p></>
                : <p>Ingen temaforslag tilgjengelig for datoen. Kontroller årgang og fagplan i årsplanen.</p>}
              <AppLink href={`${basePath}/aarsplan?year=${upcoming.date.slice(0, 4)}&month=${Number(upcoming.date.slice(5, 7))}`}>Se årsplanen →</AppLink>
            </div>}
            {upcoming.virtual || upcoming.status === "no_plan" ? <>
              <p>Ingen øktplan er opprettet ennå.</p>
              <p className="notice">{automatic
                ? `Automatisk planlegging forsøkes fra ${formatDate(generationDate(upcoming.date, group.generationDaysBefore))}, ved den daglige kjøringen kl. 06 i Oslo, før treningen starter.`
                : group.autoDraftEnabled ? "Automatisk planlegging kjører ikke i dette miljøet." : "Automatisk planlegging er slått av i laginnstillingene."}</p>
              {failedJob && <p className="notice error">Øktplanen kunne ikke opprettes automatisk. Opprett planen manuelt, eller vent på neste kjøring før treningen.</p>}
              {upcoming.virtual ? <form action={newTrainingEvent}>
                <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={upcoming.date.slice(0, 4)} />
                {Object.entries({ date: upcoming.date, startTime: upcoming.startTime, endTime: upcoming.endTime, title: upcoming.title,
                  theme: upcoming.theme, objectives: upcoming.objectives, recurrenceKey: upcoming.recurrenceKey ?? "" })
                  .map(([key, value]) => <input type="hidden" name={key} value={value} key={key} />)}
                <SubmitButton name="intent" value="create">Opprett plan nå</SubmitButton>
              </form> : <AppLink className="button button--primary" href={`${basePath}/okter/${upcoming.id}?initialDraft=1`}>Opprett plan nå</AppLink>}
            </> : <><p>{eventStatusLabels[upcoming.status]}</p><AppLink href={`${basePath}/okter/${upcoming.id}`}>Åpne øktplan →</AppLink></>}
          </> : <><p>Ingen kommende treninger er registrert.</p>
            <AppLink href={`${basePath}/innstillinger`}>Legg til faste treningstider →</AppLink></>}
        </Card>
        <section className="stack" aria-label="Siste økter"><h2>Siste økter</h2>
          {sessions?.recent.length ? sessions.recent.map((event) => <Card className="app-card" key={event.id}>
            <small>{formatDate(event.date)} · {formatTimeRange(event.startTime, event.endTime)} · {eventStatusLabels[event.status]}</small>
            <h3>{event.title}</h3><p>{event.theme || "Tema ikke satt"}</p>
            <AppLink href={`${basePath}/okter/${event.id}`}>Åpne øktplan →</AppLink>
          </Card>) : <p className="muted">Ingen tidligere økter er lagret. Bare lagrede økter vises her; gjennomføring er ikke bekreftet.</p>}
        </section>
      </div>}
      {section !== "oversikt" && <div className={`settings-content stack${section === "brukere" ? " coach-settings-content" : ""}`}>
        <div className="stack">
          {section === "innstillinger" && <Card className="app-card">
            <h2>Treningstider</h2>
            {canManage && <NewTrainingTimeDialog groupId={groupId} playerCount={group.playerCount} coachCount={group.coachCount} />}
            {details.times.length ? <ul className="clean">{details.times.map((time) => <li key={time.id}>
              <span>{weekdays[time.weekday - 1]} kl. {formatTimeRange(time.startTime, time.endTime)} <small>· {time.timezone}</small></span>
              <div className="training-time-actions"><span className="training-time-counts">Forventede spillere: {time.expectedPlayers ?? group.playerCount ?? "Ikke oppgitt"}. Trenere: {time.expectedCoaches ?? group.coachCount ?? "Alle registrerte"}.</span>
              {canManage && <><NewTrainingTimeDialog key={JSON.stringify(time)} groupId={groupId} time={time} playerCount={group.playerCount} coachCount={group.coachCount} /><form action={deleteTrainingTime}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="timeId" value={time.id} /><span title="Slett treningstid"><SubmitButton className="training-time-delete" variant="ghost" size="sm" aria-label={`Slett treningstid ${weekdays[time.weekday - 1]} kl. ${formatTimeRange(time.startTime, time.endTime)}`}><Trash2 size={17} aria-hidden="true" /></SubmitButton></span></form></>}</div>
            </li>)}</ul> : <p className="muted">Ingen faste treningstider registrert.</p>}
          </Card>}
          {section === "brukere" && <Card className="app-card">
            <div className="row"><h2>Lagets trenere</h2>{canManage && <CoachDialog groupId={groupId} />}</div>
            <p className="muted">Trenere tilhører laget og kan være med i øktplanleggingen uten egen konto. E-post er valgfritt; lagring gir ikke app-tilgang.</p>
            {details.coaches.length > 0 && <div className="coach-table-container" role="region" aria-label="Trenertabell" tabIndex={0}><table className="coach-table">
              <thead><tr><th scope="col">Navn</th><th scope="col">E-post</th><th scope="col">Status</th>{canManage && <th scope="col">Handlinger</th>}</tr></thead>
              <tbody>{details.coaches.map((coach) => <tr key={coach.id}>
              <th scope="row">{coach.name}</th><td>{coach.email || "Ikke oppgitt"}</td><td>
                {coach.role ? `${roleName(coach.role)} · Har app-tilgang`
                  : details.pending.some((invite) => invite.email === coach.email) ? "Invitert · Venter på svar" : "Uten app-tilgang"}
              </td>
              {canManage && <td className="coach-table-action-cell">
                <div className="coach-table-actions">
                  {!coach.role && coach.email && <form action={newCoachInvitation}>
                    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="coachId" value={coach.id} />
                    <SubmitButton>{details.pending.some((invite) => invite.email === coach.email) ? "Inviter på nytt" : "Inviter til appen"}</SubmitButton>
                  </form>}
                  <CoachDialog groupId={groupId} coach={{ id: coach.id, name: coach.name, email: coach.email, hasAccount: Boolean(coach.userId) }} />
                  {(details.isAdmin || coach.role !== "head_coach") && <form action={deleteTeamCoach}>
                    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="coachId" value={coach.id} />
                    <span title="Fjern trener"><SubmitButton className="coach-delete" variant="ghost" size="sm" aria-label={`Fjern trener ${coach.name}`}><Trash2 size={17} aria-hidden="true" /></SubmitButton></span>
                  </form>}
                </div>
              </td>}
            </tr>)}</tbody></table></div>}
            {!details.coaches.length && <p className="muted">Ingen trenere registrert ennå.</p>}
            {details.isAdmin && <><h3>Overfør hovedtrenerrollen</h3>
              <p className="muted">Bare klubbadministrator kan overføre rollen. Velg en eksisterende trener på laget. Tidligere hovedtrener beholdes som trener, og ubrukte hovedtrenerinvitasjoner tilbakekalles.</p>
              {details.members.some((member) => member.role === "coach") ? <form action={changeHeadCoach}>
                <input type="hidden" name="groupId" value={groupId} />
                <MemberSelect members={details.members.filter((member) => member.role === "coach")} />
                <SubmitButton>Overfør hovedtrenerrolle</SubmitButton>
              </form> : <p>En trener må først akseptere en laginvitasjon før rollen kan overføres.</p>}
            </>}
          </Card>}
        </div>
        <div className="stack">
          {section === "innstillinger" && <Card className="app-card">
            <h2>Øktrammer</h2>
            <p className="muted">Lagets nettadresse: {basePath}</p>
            {details.conflictingBirthYears.length > 0 && <p className="notice error">Tidligere årsplaner har ulike årganger ({details.conflictingBirthYears.sort().join(", ")}). Ingen årgang er valgt automatisk. Hovedtrener eller klubbadministrator må avklare og lagre lagets årgang.</p>}
            {canManage ? <form action={saveGroupSettings}>
              <input type="hidden" name="groupId" value={groupId} />
              <NativeInput label="Årgang (valgfritt)" name="birthYear" type="number" min={1900} max={2100} step={1} defaultValue={group.birthYear ?? ""} />
              <small>For eksempel 2017. Brukes i alle årsplaner og nye øktforslag. Tidligere øktversjoner endres ikke.</small>
              <DifferentiationSettings settings={group.differentiation} playerCount={group.playerCount} coachCount={group.coachCount} />
              <TextAreaInput label="Lagets generelle instrukser" name="generalInstructions" rows={5} maxLength={8000} defaultValue={group.generalInstructions} />
              <AutomaticPlanSettings enabled={group.autoDraftEnabled} days={group.generationDaysBefore} />
              <small>Lagets instrukser, aktive klubbdokumenter, årsplan og tidligere planer med evalueringer sendes til modellleverandøren ved generering. Ikke legg inn private opplysninger om barn.</small>
              <h3>Prioriteringer for AI-genererte økter</h3>
              <PlanningPrioritiesEditor key={JSON.stringify(group.aiPriorities)} priorities={group.aiPriorities} />
              <SubmitButton>Lagre rammer</SubmitButton>
            </form> : <><p>Årgang: {group.birthYear ?? "Ikke oppgitt"}.</p><p>Spillere: {group.playerCount ?? "Ikke oppgitt"}. Trenere: {group.coachCount ?? "Alle registrerte"}.</p><p>Differensiering: {group.differentiation.enabled ? "På" : "Av"}.</p>
              {group.differentiation.enabled && <ul>{group.differentiation.levels.map((level, index) => <li key={index}>Nivå {index + 1}: {level.players} spillere</li>)}</ul>}
              <p>Automatisk planlegging: {group.autoDraftEnabled ? `På, ${group.generationDaysBefore} dager før ny trening` : "Av"}.</p>
              <h3>Lagets generelle instrukser</h3><p className="preserve-lines">{group.generalInstructions || "Ingen instrukser registrert."}</p>
              <h3>Prioriteringer for AI-genererte økter</h3><PlanningPrioritiesEditor priorities={group.aiPriorities} disabled />
            </>}
            <p className="muted">Årgang settes av hovedtrener eller klubbadministrator. Øktlengden beregnes fra fra- og til-tidspunktet for hver trening. Ingen felles standardvarighet.</p>
            <p className="notice">{process.env.VERCEL_ENV === "production" ? "Automatisk oppretting krever aktiv cron-jobb og produksjonsoppsett." : "Lokalt startes øktplanlegging bare manuelt."}</p>
          </Card>}
        </div>
      </div>}
    </ClubTheme>
  );
}
