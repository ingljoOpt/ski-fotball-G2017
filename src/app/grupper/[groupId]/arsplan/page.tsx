import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { annualPlanning } from "@/lib/planning-domain";
import { nffAgeSource, type Period } from "@/lib/planning";
import { saveYearPlan, saveThemePeriod, deleteThemePeriod } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubIdentity, ClubTheme } from "@/app/club-theme";
import { AppLink, Card, NativeInput, SubmitButton, TextAreaInput, TextInput } from "@/app/ui";
import { formatDate, months, PlanningNavigation, planningSelection, YearPicker } from "@/app/planning-components";
import { AnnualWheel } from "@/app/annual-wheel";

function PeriodFields({ year, period }: { year: number; period?: Period }) {
  return <>
    <div className="form-grid">
      <NativeInput label="Fra dato" name="startDate" type="date" min={`${year}-01-01`} max={`${year}-12-31`} required defaultValue={period?.startDate} />
      <NativeInput label="Til dato" name="endDate" type="date" min={`${year}-01-01`} max={`${year}-12-31`} required defaultValue={period?.endDate} />
    </div>
    <TextInput label="Tema" name="theme" isRequired maxLength={150} defaultValue={period?.theme} />
    <TextAreaInput label="Øvingsmål" name="objectives" required rows={3} maxLength={8000} defaultValue={period?.objectives} />
    <TextAreaInput label="Progresjon og sammenheng" name="progression" rows={3} maxLength={8000} defaultValue={period?.progression} />
    <TextInput label="Kildelenke (valgfritt)" name="sourceUrl" type="url" maxLength={2000} defaultValue={period?.sourceUrl} />
  </>;
}

export default async function AnnualPlan({ params, searchParams }: {
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
  const { plan } = details;
  const ageSource = nffAgeSource(year, plan?.birthYear ?? null);
  const hidden = <>
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
    <input type="hidden" name="revision" value={plan?.revision ?? 0} />
  </>;
  return <ClubTheme club={details.club}>
    <Account email={user.email} /><ClubIdentity club={details.club} />
    <PlanningNavigation groupId={groupId} year={year} />
    <h1>Årsplan {year} · {details.group.name}</h1>
    <YearPicker year={year} />
    <Notices searchParams={searchParams} />
    <AnnualWheel key={year} year={year} months={months} periods={details.periods} initialMonth={month} />
    <div className="columns">
      <div className="stack">
        <Card className="app-card">
          <h2>Årets retning</h2>
          <form action={saveYearPlan}>{hidden}
            <NativeInput label="Fødselsår for gruppen (valgfritt)" name="birthYear" type="number" min={year - 25} max={year - 5} defaultValue={plan?.birthYear ?? ""} />
            <TextAreaInput label="Årsmål og føringer" name="objectives" rows={5} maxLength={8000} defaultValue={plan?.objectives} />
            <SubmitButton>Lagre årsplan</SubmitButton>
          </form>
        </Card>
        <Card className="app-card">
          <h2>Temaperioder og øvingsmål</h2>
          <p>Legg en rød tråd gjennom året. Perioder kan gå over flere måneder, men kan ikke overlappe. Tomme perioder fylles ikke automatisk.</p>
          {details.periods.length === 0 && <p className="muted">Ingen temaer er registrert for dette året.</p>}
          {details.periods.map((period) => <details className="exercise-detail" key={period.id} id={`periode-${period.id}`}>
            <summary><strong>{period.theme}</strong> · {formatDate(period.startDate)}–{formatDate(period.endDate)}</summary>
            <p className="preserve-lines">{period.objectives}</p>
            <form action={saveThemePeriod}>{hidden}<input type="hidden" name="periodId" value={period.id} />
              <PeriodFields year={year} period={period} /><SubmitButton>Lagre periode</SubmitButton>
            </form>
            <form action={deleteThemePeriod}>{hidden}<input type="hidden" name="periodId" value={period.id} />
              <SubmitButton variant="danger-soft" size="sm">Fjern temaperiode</SubmitButton>
            </form>
          </details>)}
          {plan ? <details className="exercise-detail"><summary>Legg til temaperiode</summary>
            <form action={saveThemePeriod}>{hidden}<PeriodFields year={year} /><SubmitButton>Legg til periode</SubmitButton></form>
          </details> : <p className="notice">Lagre årsplanen først, så kan du legge til temaperioder.</p>}
        </Card>
      </div>
      <Card className="app-card">
        <span className="eyebrow">Tilrettelagt for steg 4</span><h2>NFF som faglig utgangspunkt</h2>
        <p>{ageSource.label}</p>
        <AppLink href={ageSource.url}>Åpne NFFs sportsplan og fagplan →</AppLink>
        <p>Automatiske forslag til temaer og øvingsmål er ikke aktivert. Når AI er på plass, skal NFFs aldersriktige fagplan være standard kilde, med kildekontroll og trenergodkjenning.</p>
        <p className="muted">Årskullet oppgis eksplisitt og utledes ikke fra gruppenavnet. Alder beregnes for valgt planår.</p>
        <AppLink href={`/grupper/${groupId}/kalender?year=${year}`}>Se temaene i kalenderen →</AppLink>
      </Card>
    </div>
  </ClubTheme>;
}
