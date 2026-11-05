import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { groupCalendar } from "@/lib/planning-domain";
import { osloToday, periodsOnDate } from "@/lib/planning";
import { formatTimeRange } from "@/lib/validation";
import { newTrainingEvent } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubIdentity, ClubTheme } from "@/app/club-theme";
import { AppLink, Card, Chip, NativeInput, SubmitButton, TextInput, TextAreaInput } from "@/app/ui";
import { eventStatusLabels, formatDate, months, PlanningNavigation, planningSelection, YearPicker } from "@/app/planning-components";

export default async function Calendar({ params, searchParams }: {
  params: Promise<{ groupId: string }>; searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { groupId } = await params;
  const { year, month } = await planningSelection(searchParams);
  let details;
  try { details = await groupCalendar(await getDatabase(), user.id, groupId, year); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const selected = details.entries.filter((event) => Number(event.date.slice(5, 7)) === month);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (firstDay.getUTCDay() + 6) % 7;
  return <ClubTheme club={details.club}>
    <Account email={user.email} /><ClubIdentity club={details.club} />
    <PlanningNavigation groupId={groupId} year={year} />
    <h1>Kalender · {details.group.name}</h1>
    <YearPicker year={year} /><Notices searchParams={searchParams} />
    <p className="muted">Europe/Oslo · Faste tider vises som forventede treninger, ikke som ferdige øktplaner. Alle gruppens trenere kan planlegge. Faste tider endres i grupperommet av hovedtrener eller klubbadministrator.</p>
    <div className="year-grid" aria-label={`Årsoversikt ${year}`}>
      {months.map((label, index) => {
        const monthEntries = details.entries.filter((event) => Number(event.date.slice(5, 7)) === index + 1);
        const monthStart = `${year}-${String(index + 1).padStart(2, "0")}-01`;
        const monthEnd = `${year}-${String(index + 1).padStart(2, "0")}-31`;
        const periods = details.periods.filter((period) => period.startDate <= monthEnd && period.endDate >= monthStart);
        return <Card className={`app-card month-card ${index + 1 === month ? "selected-month" : ""}`} key={label}>
          <AppLink href={`?year=${year}&month=${index + 1}`}>{label}</AppLink>
          <small>{monthEntries.filter((event) => event.status !== "cancelled").length} treninger · {monthEntries.filter((event) => !event.virtual).length} lagrede</small>
          <span>{periods.map((period) => period.theme).join(" · ") || "Tema ikke satt"}</span>
        </Card>;
      })}
    </div>
    <h2 className="section-title">{months[month - 1]} {year}</h2>
    <div className="calendar-grid" aria-label={`${months[month - 1]} ${year}`}>
      {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => <strong key={day}>{day}</strong>)}
      {Array.from({ length: offset }, (_, index) => <div key={`empty-${index}`} />)}
      {Array.from({ length: dayCount }, (_, index) => {
        const date = `${prefix}-${String(index + 1).padStart(2, "0")}`;
        const entries = selected.filter((event) => event.date === date);
        const period = periodsOnDate(details.periods, date)[0];
        return <div className={`calendar-day ${date === osloToday() ? "today" : ""}`} key={date}>
          <a href={`#dag-${date}`} aria-label={`${formatDate(date)}${period ? `: ${period.theme}` : ""}`}>{index + 1}</a>
          {period && <span className="calendar-theme">{period.theme}</span>}
          {entries.map((event) => <small key={event.id ?? event.recurrenceKey}>
            {formatTimeRange(event.startTime, event.endTime)} · {eventStatusLabels[event.status]}
          </small>)}
        </div>;
      })}
    </div>
    <div className="columns">
      <section className="stack" aria-label="Treninger i valgt måned">
        <h2>Treninger og øktplaner</h2>
        {selected.length === 0 && <Card className="app-card"><p>Ingen treninger denne måneden. Legg til faste tider i grupperommet eller opprett en enkeltøkt.</p></Card>}
        {selected.map((event, index) => <Card className="app-card" id={index === 0 || selected[index - 1].date !== event.date ? `dag-${event.date}` : undefined} key={event.id ?? event.recurrenceKey}>
          <div className="row"><strong>{formatDate(event.date)} kl. {formatTimeRange(event.startTime, event.endTime)}</strong><Chip>{eventStatusLabels[event.status]}</Chip></div>
          <h3>{event.title}</h3>
          <p>{event.theme || "Tema ikke satt"} · {event.durationMinutes} minutter</p>
          <p className="preserve-lines">{event.objectives}</p>
          {event.virtual ? <form action={newTrainingEvent}>
            <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
            {Object.entries({ date: event.date, startTime: event.startTime, endTime: event.endTime, title: event.title,
              theme: event.theme, objectives: event.objectives, recurrenceKey: event.recurrenceKey ?? "" })
              .map(([key, value]) => <input type="hidden" name={key} value={value} key={key} />)}
            <div className="row"><SubmitButton name="intent" value="create">Planlegg denne treningen</SubmitButton>
              <SubmitButton name="intent" value="cancel" variant="danger-soft">Avlys denne treningen</SubmitButton></div>
          </form> : <AppLink href={`/grupper/${groupId}/okter/${event.id}`}>Åpne øktplan →</AppLink>}
        </Card>)}
      </section>
      <Card className="app-card">
        <h2>Ny enkeltøkt</h2>
        <p>Opprett en ekstra trening uten å endre den faste rytmen.</p>
        <form action={newTrainingEvent}>
          <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
          <TextInput label="Økttittel" name="title" isRequired minLength={2} maxLength={150} defaultValue={`${details.group.name} – trening`} />
          <NativeInput label="Dato" name="date" type="date" required defaultValue={`${prefix}-01`} />
          <NativeInput label="Fra" name="startTime" type="time" required />
          <NativeInput label="Til" name="endTime" type="time" required />
          <small>Varigheten beregnes fra tidsrommet (15–240 minutter). En tidligere til-tid betyr neste dag.</small>
          <TextInput label="Tema (valgfritt)" name="theme" maxLength={150} />
          <TextAreaInput label="Øvingsmål (valgfritt)" name="objectives" rows={3} maxLength={8000} />
          <SubmitButton>Opprett øktutkast</SubmitButton>
        </form>
        <p className="notice">AI-generering, NFF-temaforslag og automatiske kladder er ikke aktivert. Ingen økter markeres som gjennomført her.</p>
      </Card>
    </div>
  </ClubTheme>;
}
