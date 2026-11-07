import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { annualPlanning } from "@/lib/planning-domain";
import { newTrainingEvent } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { AppLink, Card, NativeInput, SubmitButton, TextAreaInput, TextInput } from "@/app/ui";
import { PlanningNavigation, planningSelection } from "@/app/planning-components";
import { teamUrl } from "@/lib/slugs";

export default async function NewSession({ params, searchParams }: {
  params: Promise<{ groupId: string }>; searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { groupId } = await params;
  const { year, month } = await planningSelection(searchParams);
  let details;
  try { details = await annualPlanning(await getDatabase(), user.id, groupId, year); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const basePath = teamUrl(details.club, details.group);
  return <ClubTheme club={details.club} header>
    <Account email={user.email} />
    <PlanningNavigation basePath={basePath} year={year} />
    <AppLink href={`${basePath}/aarsplan?year=${year}&month=${month}`}>← Årsplan</AppLink>
    <h1>Ny enkeltøkt</h1>
    <Notices searchParams={searchParams} />
    <Card className="app-card settings-content">
      <p>En ekstra trening uten å endre den faste rytmen.</p>
      <form action={newTrainingEvent}>
        <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="singleSession" value="1" />
        <TextInput label="Økttittel" name="title" isRequired minLength={2} maxLength={150} defaultValue={`${details.group.name} – trening`} />
        <NativeInput label="Dato" name="date" type="date" required defaultValue={`${year}-${String(month).padStart(2, "0")}-01`} />
        <div className="form-grid">
          <NativeInput label="Fra" name="startTime" type="time" required />
          <NativeInput label="Til" name="endTime" type="time" required />
        </div>
        <small>Tidsrom: 15–240 minutter. Tidligere til-tid betyr neste dag.</small>
        <TextInput label="Tema (valgfritt)" name="theme" maxLength={150} />
        <TextAreaInput label="Øvingsmål (valgfritt)" name="objectives" rows={3} maxLength={8000} />
        <SubmitButton>Opprett øktutkast</SubmitButton>
      </form>
    </Card>
  </ClubTheme>;
}
