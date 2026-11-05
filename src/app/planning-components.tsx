import { notFound } from "next/navigation";
import { z } from "zod";
import { osloToday, yearSchema } from "@/lib/planning";
import { NativeInput, SubmitButton } from "./ui";
import type { SearchParams } from "./components";
import { NavigationLinks } from "./navigation";

export const months = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
export const eventStatusLabels = { scheduled: "Fast trening · ingen kladd", draft: "Utkast", planned: "Planlagt", cancelled: "Avlyst" };

export async function planningSelection(searchParams: SearchParams) {
  const search = await searchParams;
  const today = osloToday();
  const year = yearSchema.safeParse(search.year ?? today.slice(0, 4));
  const month = z.coerce.number().int().min(1).max(12).safeParse(search.month ?? today.slice(5, 7));
  if (!year.success || !month.success) notFound();
  return { year: year.data, month: month.data };
}
export function PlanningNavigation({ groupId, year }: { groupId: string; year: number }) {
  return <NavigationLinks className="context-navigation" label="Gruppeplanlegging" items={[
    { href: `/grupper/${groupId}`, label: "Oversikt" },
    { href: `/grupper/${groupId}/kalender?year=${year}`, label: "Kalender" },
    { href: `/grupper/${groupId}/arsplan?year=${year}`, label: "Årsplan" },
    { href: `/grupper/${groupId}/brukere`, label: "Brukere" },
    { href: `/grupper/${groupId}/innstillinger`, label: "Innstillinger" },
  ]} />;
}
export function YearPicker({ year }: { year: number }) {
  return <form method="get" className="inline-form">
    <NativeInput label="Planår" type="number" name="year" min={2000} max={2100} required defaultValue={year} />
    <SubmitButton variant="secondary">Vis år</SubmitButton>
  </form>;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
