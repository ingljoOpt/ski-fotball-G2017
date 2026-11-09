import { notFound, redirect } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { clubBySlug, DomainError, teamBySlug } from "@/lib/domain";
import { ClubScreen } from "@/app/club-screen";
import { GroupScreen } from "@/app/group-screen";
import AnnualPlan from "@/app/planning-views/annual-page";
import TrainingSession from "@/app/planning-views/session-page";
import NewSession from "@/app/planning-views/new-session-page";
import OwnExercises from "@/app/planning-views/exercises-page";
import type { SearchParams } from "@/app/components";
import { withSearch } from "@/lib/tenant-routing";
import { teamUrl } from "@/lib/slugs";

export const maxDuration = 240;

export default async function TenantPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string; segments?: string[] }>; searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { clubSlug, segments = [] } = await params;
  const db = await getDatabase();
  let club;
  try { club = await clubBySlug(db, user.id, clubSlug); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const path = segments.join("/");
  const clubProps = { params: Promise.resolve({ clubId: club.id }), searchParams };
  if (!path) return <ClubScreen {...clubProps} />;
  if (path === "brukere" || path === "innstillinger") return <ClubScreen {...clubProps} section={path} />;
  if (path === "lag/ny") return <ClubScreen {...clubProps} section="ny-gruppe" />;
  let team;
  try { team = await teamBySlug(db, user.id, clubSlug, segments[0]); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const props = { params: Promise.resolve({ groupId: team.group.id }), searchParams };
  const section = segments.slice(1).join("/");
  if (!section || section === "okter") return <GroupScreen {...props} />;
  if (section === "brukere" || section === "innstillinger") return <GroupScreen {...props} section={section} />;
  if (section === "aarsplan") return <AnnualPlan {...props} />;
  if (section === "kalender") redirect(withSearch(`${teamUrl(team.club, team.group)}/aarsplan`, await searchParams));
  if (section === "ovelser") return <OwnExercises {...props} />;
  if (section === "okter/ny") return <NewSession {...props} />;
  if (segments.length === 3 && segments[1] === "okter") {
    return <TrainingSession params={Promise.resolve({ groupId: team.group.id, eventId: segments[2] })} searchParams={searchParams} />;
  }
  notFound();
}
