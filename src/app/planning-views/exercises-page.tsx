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
import { getCustomExercise, listCustomExercises } from "@/lib/custom-exercise-domain";
import { CustomExerciseBank, ExerciseForm, ExerciseReader } from "@/app/custom-exercise-bank";

export default async function OwnExercises({ params, exerciseId, edit = false }: {
  params: Promise<{ groupId: string }>; exerciseId?: string; edit?: boolean;
}) {
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
  if (exerciseId) {
    let exercise;
    try { exercise = await getCustomExercise(await getDatabase(), user.id, groupId, exerciseId); }
    catch (error) {
      if (error instanceof DomainError || error instanceof ZodError) notFound();
      throw error;
    }
    if (!exercise) notFound();
    if (edit && !details.role) notFound();
    const curriculum = edit ? await getNffCurriculum(age) : null;
    return <ClubTheme club={details.club} header>
      <Account email={user.email} />
      <PlanningNavigation basePath={basePath} year={Number(osloToday().slice(0, 4))} />
      <div className="row own-exercise-heading">
        <h1>{edit ? `Rediger øvelse · ${exercise.title}` : exercise.title}</h1>
        {!edit && details.role && <a className="button button--md button--secondary"
          href={`${basePath}/ovelser/${exercise.id}/rediger`}>Rediger øvelse</a>}
      </div>
      {edit && curriculum ? <ExerciseForm groupId={groupId} basePath={basePath} exercise={exercise}
        topics={curriculum.topics.map(({ id, theme, sourceUrl }) => ({ id, theme, sourceUrl }))} age={age} />
        : <ExerciseReader exercise={exercise} basePath={basePath} />}
    </ClubTheme>;
  }
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
