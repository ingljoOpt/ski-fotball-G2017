import type { groupCalendar } from "@/lib/planning-domain";
import { annualEventLabels, eventsDuring, osloToday, parseSkillObjectives, periodsOnDate, slotKey, type AnnualEvent, type ThemeSuggestion } from "@/lib/planning";
import { formatTimeRange } from "@/lib/validation";
import { deleteYearEvent, newTrainingEvent, saveYearEvent, lockTrainingFocus } from "@/app/actions";
import { AppLink, Card, Chip, NativeInput, OptionSelect, SubmitButton, TextAreaInput, TextInput } from "@/app/ui";
import { eventStatusLabels, formatDate, months } from "@/app/planning-components";
import type { Curriculum } from "@/lib/nff-curriculum";
import { SessionSkillFields } from "@/app/nff-curriculum-list";

export function AnnualEventFields({ date, event }: { date: string; event?: AnnualEvent }) {
  return <>
    <TextInput label="Tittel" name="title" isRequired minLength={2} maxLength={150} defaultValue={event?.title} placeholder="For eksempel høstferie eller cup" />
    <OptionSelect label="Type hendelse" name="kind" isRequired defaultValue={event?.kind ?? "other"}
      options={Object.entries(annualEventLabels).map(([id, label]) => ({ id, label }))} />
    <div className="form-grid">
      <NativeInput label="Fra dato" name="startDate" type="date" required defaultValue={event?.startDate ?? date} min="2000-01-01" max="2100-12-31" />
      <NativeInput label="Til dato" name="endDate" type="date" required defaultValue={event?.endDate ?? date} min="2000-01-01" max="2100-12-31" />
    </div>
    <TextAreaInput label="Beskrivelse (valgfritt)" name="description" rows={3} maxLength={8000} defaultValue={event?.description} />
  </>;
}

export function AnnualMonth({ details, year, month, basePath, curriculum, suggestion }: {
  details: Awaited<ReturnType<typeof groupCalendar>>; year: number; month: number; basePath: string; curriculum?: Curriculum; suggestion?: ThemeSuggestion;
}) {
  const groupId = details.group.id;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const entries = details.entries.filter((entry) => entry.date.startsWith(prefix));
  function sessionIndex(entry: typeof entries[number]) {
    const startDate = periodsOnDate(details.periods, entry.date)[0]?.startDate ?? suggestion?.startDate ?? `${prefix}-01`;
    return details.entries.filter((item) => item.status !== "cancelled" && item.date >= startDate
      && slotKey(item.date, item.startTime) < slotKey(entry.date, entry.startTime)).length;
  }
  const events = eventsDuring(details.events, `${prefix}-01`, `${prefix}-${dayCount}`);
  const hidden = <>
    <input type="hidden" name="groupId" value={groupId} />
    <input type="hidden" name="year" value={year} /><input type="hidden" name="month" value={month} />
  </>;
  return <div className="annual-month-view stack">
    <div className="row">
      <h2>{months[month - 1]} {year} · Treninger og hendelser</h2>
      <AppLink href={`${basePath}/okter/ny?year=${year}&month=${month}`}>+ Ny enkeltøkt</AppLink>
    </div>
    <p className="muted">Velg en dag for å se treningene og hendelsene. Hendelser gjelder hele dager og kan gå over flere måneder eller år.</p>
    {events.length > 0 && <p className="muted">◆ Hendelser</p>}
    <div className="calendar-grid" aria-label={`${months[month - 1]} ${year}`}>
      {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => <strong key={day}>{day}</strong>)}
      {Array.from({ length: offset }, (_, index) => <div key={`empty-${index}`} />)}
      {Array.from({ length: dayCount }, (_, index) => {
        const date = `${prefix}-${String(index + 1).padStart(2, "0")}`;
        const training = entries.filter((entry) => entry.date === date);
        const activities = eventsDuring(events, date);
        const period = periodsOnDate(details.periods, date)[0];
        return <div key={date} className={`calendar-day ${date === osloToday() ? "today" : ""}`}>
          <a href={training.length || activities.length ? `#dag-${date}` : undefined} aria-label={`${formatDate(date)} · ${training.length} treninger · ${activities.length} hendelser`}>{index + 1}</a>
          {training.length > 0 && <span className="calendar-count">{training.length} økt{training.length === 1 ? "" : "er"}</span>}
          {activities.length > 0 && <span className="annual-event-count" aria-label={`${activities.length} hendelse${activities.length === 1 ? "" : "r"}`}>
            {activities.length}<span className="annual-count-label" aria-hidden="true"> hendelse{activities.length === 1 ? "" : "r"}</span><span className="annual-count-symbol" aria-hidden="true"> ◆</span>
          </span>}
          {period && <span className="calendar-theme">{period.theme}</span>}
          {training.map((entry) => <small key={entry.id ?? entry.recurrenceKey}>{entry.startTime} · {eventStatusLabels[entry.status]}</small>)}
          {activities.map((event) => <small className="annual-event-label" key={event.id}>{annualEventLabels[event.kind]} · {event.title}</small>)}
        </div>;
      })}
    </div>
    <details className="exercise-detail">
      <summary>+ Legg til cup, ferie eller annen hendelse</summary>
      <p className="notice">Hendelser avlyser ikke treninger automatisk. Avlys aktuelle enkelttreninger nedenfor ved behov.</p>
      <form action={saveYearEvent}>{hidden}<AnnualEventFields date={`${prefix}-01`} /><SubmitButton>Legg til hendelse</SubmitButton></form>
    </details>
    <section className="stack" aria-label="Månedens treninger og hendelser">
      <h3>Dag for dag</h3>
      {!entries.length && !events.length && <p>Ingen treninger eller hendelser er registrert denne måneden.</p>}
      {Array.from({ length: dayCount }, (_, index) => {
        const date = `${prefix}-${String(index + 1).padStart(2, "0")}`;
        const training = entries.filter((entry) => entry.date === date);
        const activities = eventsDuring(events, date);
        if (!training.length && !activities.length) return null;
        return <section className="annual-day stack" id={`dag-${date}`} key={date}>
          <h4>{formatDate(date)}</h4>
          {activities.map((event) => <Card className="app-card annual-event-card" key={event.id}>
            <div className="row"><h5>{event.title}</h5><Chip>{annualEventLabels[event.kind]}</Chip></div>
            <p>{event.startDate === event.endDate ? "Hele dagen" : `${formatDate(event.startDate)}–${formatDate(event.endDate)}`}</p>
            {event.description && <p className="preserve-lines">{event.description}</p>}
            <AppLink href={`#hendelse-${event.id}`}>Rediger hendelsen →</AppLink>
          </Card>)}
          {training.map((entry) => <Card className="app-card" key={entry.id ?? entry.recurrenceKey}>
            <div className="row"><strong>Trening · {formatTimeRange(entry.startTime, entry.endTime)}</strong><Chip>{eventStatusLabels[entry.status]}</Chip></div>
            <h5>{entry.title}</h5><p>{entry.theme || "Øktfokus fra månedens tema"} · {entry.durationMinutes} minutter</p>
            <p className="preserve-lines">{entry.objectives}</p>
            {entry.virtual ? <form action={newTrainingEvent}>{hidden}
              {Object.entries({ date: entry.date, startTime: entry.startTime, endTime: entry.endTime, title: entry.title,
                recurrenceKey: entry.recurrenceKey ?? "" })
                .map(([key, value]) => <input type="hidden" name={key} value={value} key={key} />)}
              <SessionSkillFields theme={entry.theme} objectives={entry.objectives}
                sessionIndex={sessionIndex(entry)}
                skills={curriculum?.topics.find((topic) => topic.kind === "main" && topic.theme === entry.theme)?.skills ?? []} />
              <div className="row"><SubmitButton name="intent" value="lock-focus">Lås øktfokus</SubmitButton>
                <SubmitButton name="intent" value="create" variant="secondary">Planlegg denne treningen</SubmitButton>
                <SubmitButton name="intent" value="cancel" variant="danger-soft">Avlys denne treningen</SubmitButton></div>
            </form> : <>
              {entry.id && entry.status !== "cancelled" && "planDeletedAt" in entry && !entry.planDeletedAt && <form action={lockTrainingFocus}>{hidden}
                <input type="hidden" name="eventId" value={entry.id} /><input type="hidden" name="revision" value={entry.revision} />
                <SessionSkillFields key={`${entry.id}-${entry.revision}`} theme={entry.theme} objectives={entry.objectives} locked={Boolean(parseSkillObjectives(entry.objectives))}
                  sessionIndex={sessionIndex(entry)}
                  skills={curriculum?.topics.find((topic) => topic.kind === "main" && topic.theme === entry.theme)?.skills ?? []} />
                <SubmitButton>Lås øktfokus</SubmitButton>
              </form>}
              <AppLink href={`${basePath}/okter/${entry.id}`}>Åpne øktplan →</AppLink>
            </>}
          </Card>)}
        </section>;
      })}
    </section>
    {events.length > 0 && <section className="stack" aria-label="Rediger månedens hendelser">
      <h3>Administrer hendelser</h3>
      {events.map((event) => <details className="exercise-detail" id={`hendelse-${event.id}`} key={event.id}>
        <summary>{event.title} · {annualEventLabels[event.kind]}</summary>
        <form action={saveYearEvent}>{hidden}<input type="hidden" name="annualEventId" value={event.id} />
          <input type="hidden" name="revision" value={event.revision} />
          <AnnualEventFields date={`${prefix}-01`} event={event} /><SubmitButton>Lagre hendelse</SubmitButton>
        </form>
        <form action={deleteYearEvent}>{hidden}<input type="hidden" name="annualEventId" value={event.id} />
          <input type="hidden" name="revision" value={event.revision} /><SubmitButton variant="danger-soft">Fjern hendelse</SubmitButton>
        </form>
      </details>)}
    </section>}
  </div>;
}
