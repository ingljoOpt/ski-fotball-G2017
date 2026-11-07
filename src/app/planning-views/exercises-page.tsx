import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError, groupDetails } from "@/lib/domain";
import { osloToday } from "@/lib/planning";
import { Account } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { PlanningNavigation } from "@/app/planning-components";
import { teamUrl } from "@/lib/slugs";

export default async function OwnExercises({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await requireUser();
  const { groupId } = await params;
  let details;
  try { details = await groupDetails(await getDatabase(), user.id, groupId); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const basePath = teamUrl(details.club, details.group);
  return <ClubTheme club={details.club} header>
    <Account email={user.email} />
    <PlanningNavigation basePath={basePath} year={Number(osloToday().slice(0, 4))} />
    <h1>Egne øvelser · {details.group.name}</h1>
    <p>Lag og rediger egne animasjoner med spillere, baller, kjegler og mål.</p>
    <p className="notice">Last ned JSON for å ta vare på arbeidet, og åpne filen her for å redigere videre.
      Animasjoner lagres foreløpig som filer hos deg, ikke i en delt øvelsesbank for laget.</p>
    <iframe className="exercise-editor-frame" title="Rediger egne øvelser og animasjoner"
      src={`${basePath}/ovelser/rediger/editor`} />
  </ClubTheme>;
}
