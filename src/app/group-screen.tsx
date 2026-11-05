import { AppLink, Card, MemberSelect, NativeInput, SubmitButton, TextInput, WeekdaySelect } from "@/app/ui";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError, groupDetails } from "@/lib/domain";
import { changeHeadCoach, deleteMember, deleteTrainingTime, newCoachInvitation, newTrainingTime, saveGroupSettings } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubIdentity, ClubTheme } from "@/app/club-theme";
import { osloToday } from "@/lib/planning";
import { PlanningNavigation } from "@/app/planning-components";
import { formatTimeRange } from "@/lib/validation";

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
  return (
    <ClubTheme club={details.club}>
      <Account email={user.email} />
      <AppLink className="back" href={`/klubber/${group.clubId}`}>← Til klubben</AppLink>
      <ClubIdentity club={details.club} />
      <span className="eyebrow">{section === "oversikt" ? "Gruppens trenerrom" : group.name}</span>
      <h1>{section === "oversikt" ? group.name : section === "brukere" ? "Trenere og brukere" : "Gruppeinnstillinger"}</h1>
      <PlanningNavigation groupId={groupId} year={Number(osloToday().slice(0, 4))} />
      <Notices searchParams={searchParams} />
      {section === "oversikt" && <div className="page-content">
        <div className="quick-links">
          <Card className="app-card"><h2>Kalender</h2><p>Finn treninger og lag øktplaner.</p><AppLink href={`/grupper/${groupId}/kalender`}>Åpne kalender →</AppLink></Card>
          <Card className="app-card"><h2>Årsplan</h2><p>Planlegg temaer, øvingsmål og progresjon.</p><AppLink href={`/grupper/${groupId}/arsplan`}>Åpne årsplan →</AppLink></Card>
        </div>
        <Card className="app-card"><h2>Faste treningstider</h2>
          {details.times.length ? <ul className="clean">{details.times.map((time) => <li key={time.id}>{weekdays[time.weekday - 1]} kl. {formatTimeRange(time.startTime, time.endTime)}</li>)}</ul> : <p>Ingen faste tider registrert.</p>}
          <AppLink href={`/grupper/${groupId}/innstillinger`}>Se treningstider og innstillinger →</AppLink>
        </Card>
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
            <h2>Trenergruppen</h2>
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
              <p className="muted">Bare klubbadministrator kan overføre rollen. Velg en eksisterende trener i gruppen. Tidligere hovedtrener beholdes som trener, og ubrukte hovedtrenerinvitasjoner tilbakekalles.</p>
              {details.members.some((member) => member.role === "coach") ? <form action={changeHeadCoach}>
                <input type="hidden" name="groupId" value={groupId} />
                <MemberSelect members={details.members.filter((member) => member.role === "coach")} />
                <SubmitButton>Overfør hovedtrenerrolle</SubmitButton>
              </form> : <p>En trener må først akseptere en gruppeinvitasjon før rollen kan overføres.</p>}
            </>}
          </Card>}
        </div>
        <div className="stack">
          {section === "innstillinger" && <Card className="app-card">
            <h2>Øktrammer</h2>
            {canManage ? <form action={saveGroupSettings}>
              <input type="hidden" name="groupId" value={groupId} />
              <NativeInput label="Dager før trening for nytt utkast" name="generationDaysBefore" type="number" min={0} max={30} required defaultValue={group.generationDaysBefore} />
              <SubmitButton>Lagre rammer</SubmitButton>
            </form> : <p>Ønsket utkast {group.generationDaysBefore} dager før trening.</p>}
            <p className="muted">Øktlengden beregnes fra fra- og til-tidspunktet for hver trening. Ingen felles standardvarighet.</p>
            <p className="notice">Innstillingene lagres nå. Automatisk oppretting og AI-planlegging kommer i neste steg og er ikke aktivert.</p>
          </Card>}
        </div>
      </div>}
    </ClubTheme>
  );
}
