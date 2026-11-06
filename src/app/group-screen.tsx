import { AppLink, Card, MemberSelect, NativeInput, SubmitButton, TextInput, WeekdaySelect } from "@/app/ui";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError, groupDetails } from "@/lib/domain";
import { changeHeadCoach, deleteMember, deleteTrainingTime, newCoachInvitation, newTrainingEvent, newTrainingTime, saveGroupSettings } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubIdentity, ClubTheme } from "@/app/club-theme";
import { generationDate, osloToday } from "@/lib/planning";
import { groupSessions } from "@/lib/planning-domain";
import { eventStatusLabels, formatDate, PlanningNavigation } from "@/app/planning-components";
import { formatTimeRange } from "@/lib/validation";
import { clubUrl, teamUrl } from "@/lib/slugs";

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
  return (
    <ClubTheme club={details.club}>
      <Account email={user.email} />
      <AppLink className="back" href={clubUrl(details.club)}>← Til klubben</AppLink>
      <ClubIdentity club={details.club} />
      <span className="eyebrow">{section === "oversikt" ? "Lagets trenerrom" : group.name}</span>
      <h1>{section === "oversikt" ? `Økter · ${group.name}` : section === "brukere" ? "Trenere og brukere" : "Laginnstillinger"}</h1>
      <PlanningNavigation basePath={basePath} year={Number(osloToday().slice(0, 4))} />
      <Notices searchParams={searchParams} />
      {section === "oversikt" && <div className="page-content">
        <div className="row"><AppLink href={`${basePath}/okter/ny`}>+ Opprett økt manuelt</AppLink>
          <AppLink href={`${basePath}/aarsplan`}>Se treninger og hendelser i årsplanen →</AppLink></div>
        <Card className="app-card"><h2>Kommende økt</h2>
          {upcoming ? <>
            <p><strong>{formatDate(upcoming.date)} kl. {formatTimeRange(upcoming.startTime, upcoming.endTime)}</strong></p>
            <h3>{upcoming.title}</h3><p>{upcoming.theme || "Tema ikke satt"} · {upcoming.durationMinutes} minutter</p>
            {upcoming.virtual ? <>
              <p>Ingen øktplan er opprettet ennå.</p>
              <p className="notice">Ønsket genereringsdato: {formatDate(generationDate(upcoming.date, group.generationDaysBefore))} ({group.generationDaysBefore} dager før trening).
                Automatisk generering er ikke aktivert ennå; dette er en plassholder, ikke en planlagt AI-jobb.</p>
              <form action={newTrainingEvent}>
                <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={upcoming.date.slice(0, 4)} />
                {Object.entries({ date: upcoming.date, startTime: upcoming.startTime, endTime: upcoming.endTime, title: upcoming.title,
                  theme: upcoming.theme, objectives: upcoming.objectives, recurrenceKey: upcoming.recurrenceKey ?? "" })
                  .map(([key, value]) => <input type="hidden" name={key} value={value} key={key} />)}
                <SubmitButton name="intent" value="create">Opprett denne økten manuelt</SubmitButton>
              </form>
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
      {section !== "oversikt" && <div className="settings-content stack">
        <div className="stack">
          {section === "innstillinger" && <Card className="app-card">
            <h2>Treningstider</h2>
            {details.times.length ? <ul className="clean">{details.times.map((time) => <li className="row" key={time.id}>
              <span>{weekdays[time.weekday - 1]} kl. {formatTimeRange(time.startTime, time.endTime)} <small>· {time.timezone}</small></span>
              {canManage && <form action={deleteTrainingTime}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="timeId" value={time.id} /><SubmitButton variant="danger-soft" size="sm">Fjern tid</SubmitButton></form>}
            </li>)}</ul> : <p className="muted">Ingen faste treningstider registrert.</p>}
            {canManage && <form className="inline-form" action={newTrainingTime}>
              <input type="hidden" name="groupId" value={groupId} />
              <WeekdaySelect />
              <NativeInput label="Fra" type="time" name="startTime" required />
              <NativeInput label="Til" type="time" name="endTime" required /><SubmitButton>Legg til tid</SubmitButton>
            </form>}
            <small>Tidsrom: 15–240 minutter. En tidligere til-tid betyr avslutning neste dag.</small>
          </Card>}
          {section === "brukere" && <Card className="app-card">
            <h2>Lagets trenere</h2>
            <ul className="clean">{details.members.map((member) => <li className="row" key={member.userId}>
              <span>{member.email}<br /><small>{roleName(member.role)}</small></span>
              {canManage && (details.isAdmin || member.role === "coach") && <form action={deleteMember}>
                <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="userId" value={member.userId} /><SubmitButton variant="danger-soft" size="sm">Fjern medlem</SubmitButton>
              </form>}
            </li>)}</ul>
            {!details.members.length && <p className="muted">Venter på at hovedtrener aksepterer invitasjonen.</p>}
            {canManage && <><h3>Inviter trener</h3><form action={newCoachInvitation}>
              <input type="hidden" name="groupId" value={groupId} />
              <TextInput label="E-postadresse" type="email" name="email" isRequired /><SubmitButton>Inviter trener</SubmitButton>
            </form></>}
            {details.pending.length > 0 && <><h3>Venter på svar</h3><ul className="clean">{details.pending.map((invite) => <li key={invite.id}>{invite.email}<br /><small>{roleName(invite.role)}</small></li>)}</ul></>}
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
              <NativeInput label="Dager før trening for nytt utkast" name="generationDaysBefore" type="number" min={0} max={30} required defaultValue={group.generationDaysBefore} />
              <SubmitButton>Lagre rammer</SubmitButton>
            </form> : <><p>Årgang: {group.birthYear ?? "Ikke oppgitt"}.</p><p>Ønsket utkast {group.generationDaysBefore} dager før trening.</p></>}
            <p className="muted">Årgang settes av hovedtrener eller klubbadministrator. Øktlengden beregnes fra fra- og til-tidspunktet for hver trening. Ingen felles standardvarighet.</p>
            <p className="notice">Innstillingene lagres nå. Automatisk oppretting er ikke aktivert. AI-øktassistenten kan brukes manuelt i øktredigeringen.</p>
          </Card>}
        </div>
      </div>}
    </ClubTheme>
  );
}
