import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { annualPlanHistory, groupCalendar } from "@/lib/planning-domain";
import { annualThemeSuggestions, nffAgeSource } from "@/lib/planning";
import { saveThemePeriod, unlockMonthTheme } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { AppLink, Card, SubmitButton } from "@/app/ui";
import { months, PlanningNavigation, planningSelection, YearPicker } from "@/app/planning-components";
import { AnnualWheel, SelectedMonthInput } from "@/app/annual-wheel";
import { PlanningHistory } from "@/app/planning-history";
import { teamUrl } from "@/lib/slugs";
import { AnnualMonth } from "@/app/annual-month";
import { getNffCurriculum } from "@/lib/nff-curriculum";
import { NffCurriculumDrawer, ThemePeriodFields } from "@/app/nff-curriculum-list";
import { PlanningDnd } from "@/app/planning-dnd";
import { Lock } from "lucide-react";

export default async function AnnualPlan({ params, searchParams }: {
  params: Promise<{ groupId: string }>; searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { groupId } = await params;
  const { year, month } = await planningSelection(searchParams);
  let details;
  let history;
  const db = await getDatabase();
  try {
    details = await groupCalendar(db, user.id, groupId, year);
    history = await annualPlanHistory(db, user.id, groupId, year);
  }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const { plan } = details;
  const basePath = teamUrl(details.club, details.group);
  const ageSource = nffAgeSource(year, details.group.birthYear);
  const curriculum = await getNffCurriculum(ageSource.age);
  const suggestions = annualThemeSuggestions(year, details.periods, curriculum.topics);
  const hidden = <>
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} /><SelectedMonthInput month={month} />
    <input type="hidden" name="revision" value={plan?.revision ?? 0} />
  </>;
  return <ClubTheme club={details.club} header>
    <Account email={user.email} />
    <PlanningNavigation basePath={basePath} year={year} />
    <h1>Årsplan {year} · {details.group.name}</h1>
    <PlanningDnd key={`${year}-${details.group.birthYear}`}>
    <div className="row annual-toolbar"><YearPicker year={year} month={month} />
      <NffCurriculumDrawer key={`${year}-${details.group.birthYear}`} birthYear={details.group.birthYear} settingsPath={`${basePath}/innstillinger`}
        curriculum={curriculum} groupId={groupId} year={year} revision={plan?.revision ?? 0} initialMonth={month} />
    </div>
    {details.group.birthYear === null && <p className="notice" role="alert">Årskull er ikke satt for laget. <AppLink href={`${basePath}/innstillinger`}>Åpne laginnstillinger</AppLink></p>}
    <Notices searchParams={searchParams} />
    <AnnualWheel key={`${year}-${month}`} year={year} months={months} periods={details.periods} initialMonth={month} suggestions={suggestions}
      curriculumTopics={curriculum.topics} groupId={groupId} revision={plan?.revision ?? 0}
      periodEditors={Object.fromEntries(details.periods.flatMap((period) => months.flatMap((name, index) => {
        const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
        if (period.startDate > `${prefix}-31` || period.endDate < `${prefix}-01`) return [];
        return [[`${period.id}-${index + 1}`, <form action={unlockMonthTheme} key={`${period.id}-${index}`}>
          <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={index + 1} /><input type="hidden" name="revision" value={plan?.revision ?? 0} />
          <input type="hidden" name="periodId" value={period.id} />
          <span title="Lås opp tema for måneden"><SubmitButton className="planning-info-button" variant="secondary" aria-label={`Lås opp tema for ${name.toLocaleLowerCase("nb")}`} aria-pressed={true}><Lock size={18} aria-hidden="true" /></SubmitButton></span>
        </form>]];
      })))}
      monthContent={months.map((_, index) => <div key={index}>
        <details className="annual-period-editor"><summary>Ny periode</summary><form action={saveThemePeriod}>{hidden}
          <ThemePeriodFields year={year} month={index + 1} topics={curriculum.topics} /><SubmitButton>Bekreft og lås perioden</SubmitButton>
        </form></details>
        <AnnualMonth details={details} year={year} month={index + 1} basePath={basePath} curriculum={curriculum}
          suggestion={suggestions.find((proposal) => proposal.startDate <= `${year}-${String(index + 1).padStart(2, "0")}-31` && proposal.endDate >= `${year}-${String(index + 1).padStart(2, "0")}-01`)} />
      </div>)} />
    </PlanningDnd>
    <Card className="app-card"><PlanningHistory entries={history} /></Card>
  </ClubTheme>;
}
