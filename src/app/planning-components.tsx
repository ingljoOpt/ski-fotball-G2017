import { notFound } from "next/navigation";
import { z } from "zod";
import { osloToday, yearSchema } from "@/lib/planning";
import { NativeInput, SubmitButton } from "./ui";
import type { SearchParams } from "./components";
import { NavigationLinks } from "./navigation";
import { SelectedMonthInput } from "./annual-wheel";

export const months = ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"];
export const eventStatusLabels = { scheduled: "Fast trening · ingen kladd", no_plan: "Ingen aktiv øktplan", draft: "Utkast", planned: "Planlagt", cancelled: "Avlyst" };

export async function planningSelection(searchParams: SearchParams) {
  const search = await searchParams;
  const today = osloToday();
  const year = yearSchema.safeParse(search.year ?? today.slice(0, 4));
  const month = z.coerce.number().int().min(1).max(12).safeParse(search.month ?? today.slice(5, 7));
  if (!year.success || !month.success) notFound();
  return { year: year.data, month: month.data };
}
export function PlanningNavigation({ basePath, year }: { basePath: string; year: number }) {
  return <NavigationLinks className="context-navigation" label="Lagmeny" items={[
    { href: basePath, label: "Økter" },
    { href: `${basePath}/aarsplan?year=${year}`, label: "Årsplan" },
    { href: `${basePath}/brukere`, label: "Brukere" },
    { href: `${basePath}/innstillinger`, label: "Innstillinger" },
    { href: `${basePath}/ovelser`, label: "Egne øvelser" },
  ]} />;
}
export function YearPicker({ year, month }: { year: number; month?: number }) {
  return <form method="get" className="inline-form">
    {month !== undefined && <SelectedMonthInput month={month} />}
    <NativeInput label="Planår" type="number" name="year" min={2000} max={2100} required defaultValue={year} />
    <SubmitButton variant="secondary">Vis år</SubmitButton>
  </form>;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("nb-NO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
