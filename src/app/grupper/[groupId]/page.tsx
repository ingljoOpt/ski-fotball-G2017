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

const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const roleName = (role: string) => role === "head_coach" ? "Hovedtrener" : "Trener";

export default async function Group({ params, searchParams }: {
  params: Promise<{ groupId: string }>; searchParams: SearchParams;
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
      <span className="eyebrow">Gruppens trenerrom</span>
      <h1>{group.name}</h1>
      <p className="lead">Felles rammer, treningstider og mennesker rundt laget.</p>
      <PlanningNavigation groupId={groupId} year={Number(osloToday().slice(0, 4))} />
      <Notices searchParams={searchParams} />
      <div className="columns">
        <div className="stack">
          <Card className="app-card">
            <h2>Treningstider</h2>
            {details.times.length ? <ul className="clean">{details.times.map((time) => <li className="row" key={time.id}>
              <span>{weekdays[time.weekday - 1]} kl. {time.startTime} <small>· {time.timezone}</small></span>
              {canManage && <form action={deleteTrainingTime}><input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="timeId" value={time.id} /><SubmitButton variant="danger-soft" size="sm">Fjern tid</SubmitButton></form>}
            </li>)}</ul> : <p className="muted">Ingen faste treningstider registrert.</p>}
            {canManage && <form className="inline-form" action={newTrainingTime}>
              <input type="hidden" name="groupId" value={groupId} />
              <WeekdaySelect />
              <NativeInput label="Klokkeslett" type="time" name="startTime" required /><SubmitButton>Legg til tid</SubmitButton>
            </form>}
          </Card>
          <Card className="app-card">
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
          </Card>
        </div>
        <div className="stack">
          <Card className="app-card">
            <h2>Øktrammer</h2>
            {canManage ? <form action={saveGroupSettings}>
              <input type="hidden" name="groupId" value={groupId} />
              <NativeInput label="Øktlengde i minutter" name="durationMinutes" type="number" min={15} max={240} required defaultValue={group.durationMinutes} />
              <NativeInput label="Dager før trening for nytt utkast" name="generationDaysBefore" type="number" min={0} max={30} required defaultValue={group.generationDaysBefore} />
              <SubmitButton>Lagre rammer</SubmitButton>
            </form> : <p>{group.durationMinutes} minutter per økt. Ønsket utkast {group.generationDaysBefore} dager før trening.</p>}
            <p className="notice">Innstillingene lagres nå. Automatisk oppretting og AI-planlegging kommer i neste steg og er ikke aktivert.</p>
          </Card>
          <Card className="app-card"><span className="eyebrow">Planlegging</span><h2>Fra rammer til økter</h2>
            <AppLink href={`/grupper/${groupId}/kalender`}>Åpne kalender og øktplanlegging →</AppLink>
            <AppLink href={`/grupper/${groupId}/arsplan`}>Årsplan, temaer og øvingsmål →</AppLink>
            <p className="muted">AI, automatisk oppretting, evaluering og offentlig deling er ikke aktivert ennå.</p>
          </Card>
        </div>
      </div>
    </ClubTheme>
  );
}
