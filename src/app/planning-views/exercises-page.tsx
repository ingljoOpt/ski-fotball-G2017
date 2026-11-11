import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError, groupDetails } from "@/lib/domain";
import { nffAgeSource, osloToday } from "@/lib/planning";
import { Account } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { PlanningNavigation } from "@/app/planning-components";
import { teamUrl } from "@/lib/slugs";
import { getNffCurriculum } from "@/lib/nff-curriculum";
import { listCustomExercises } from "@/lib/custom-exercise-domain";
import { CustomExerciseBank } from "@/app/custom-exercise-bank";

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
  const age = nffAgeSource(Number(osloToday().slice(0, 4)), details.group.birthYear).age;
  const [exercises, curriculum] = await Promise.all([
    listCustomExercises(await getDatabase(), user.id, groupId), getNffCurriculum(age),
  ]);
  return <ClubTheme club={details.club} header>
    <Account email={user.email} />
    <PlanningNavigation basePath={basePath} year={Number(osloToday().slice(0, 4))} />
    <h1>Egne øvelser · {details.group.name}</h1>
    <p>Lag og del egne øvelser med trenerne på laget.</p>
    <CustomExerciseBank groupId={groupId} basePath={basePath} exercises={exercises}
      topics={curriculum.topics.map(({ id, theme, sourceUrl }) => ({ id, theme, sourceUrl }))} age={age} />
  </ClubTheme>;
}
