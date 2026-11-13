import { checkSessionPlan, sessionSections, shortSessionSummary, stageLabels, type EventInput, type Exercise, type SessionPlan } from "@/lib/planning";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppLink, Chip } from "./ui";
import { formatDate } from "./planning-components";
import type { ReactNode } from "react";
import { ExerciseContent } from "./custom-exercise-bank";
import { exerciseResourceDetails } from "@/lib/session-exercise-resources";

export type EditSection = "rammer" | "introduksjon" | "deltakere" | "ovingsmal";

function EditButton({ label, onEdit }: { label: string; onEdit?: () => void }) {
  return onEdit && <span className="session-item-actions"><button type="button" title={`Rediger ${label}`} aria-label={`Rediger ${label}`}
    onClick={onEdit}><Pencil size={17} aria-hidden="true" /></button></span>;
}

export function SessionHeading({ groupName, event, status, version, onEdit, editor }: {
  groupName: string; event: EventInput; status: string; version: string; onEdit?: () => void; editor?: ReactNode;
}) {
  return <header className="session-heading">
    <div className="session-section-heading"><span className="eyebrow">{groupName} · Økt</span><EditButton label="øktens rammer" onEdit={onEdit} /></div>
    {editor || <>
    <h1>{event.title}</h1>
    <div className="row"><p>
      {formatDate(event.date)} kl. {event.startTime}–{event.endTime}
      {event.endTime < event.startTime ? " (neste dag)" : ""} · Europe/Oslo
    </p><Chip>{status}</Chip></div>
    <small>{version}</small>
    </>}
  </header>;
}

export function SessionPlanView({ plan, coaches = [], durationMinutes, theme, objectives, ageLabel, idPrefix = "plan", showLegacy = false, onEdit, onRemove, onAdd, addDisabled, onEditSection, sectionEditor, exerciseEditor }: {
  plan: SessionPlan; coaches?: { id: string; name: string }[]; durationMinutes: number; theme?: string; objectives?: string; ageLabel?: string; idPrefix?: string; showLegacy?: boolean;
  onEdit?: (exerciseId: string) => void; onRemove?: (exerciseId: string, label: string) => void;
  onAdd?: (stage: Exercise["stage"], insertAt: number, trigger: HTMLButtonElement) => void; addDisabled?: boolean;
  onEditSection?: (section: EditSection) => void;
  sectionEditor?: (section: EditSection) => ReactNode; exerciseEditor?: (id: string) => ReactNode;
}) {
  const check = checkSessionPlan(plan, durationMinutes);
  const sections = sessionSections(plan.exercises, true);
  const longIntroduction = plan.introduction.length > 250;
  return <div className="session-plan">
    {(plan.introduction || onEditSection || sectionEditor?.("introduksjon")) && <div className="session-introduction session-section-heading">
      <div>
        {sectionEditor?.("introduksjon") ||
          <p className="preserve-lines">{longIntroduction ? shortSessionSummary(theme, plan.exercises) : plan.introduction || "Ingen introduksjon."}</p>}
      </div>
      <EditButton label="introduksjon" onEdit={onEditSection ? () => onEditSection("introduksjon") : undefined} />
    </div>}
    <div className="session-overview">
      {sectionEditor?.("deltakere") || <dl className="session-facts">
        {theme !== undefined && <div><dt className="session-section-heading"><span>Tema</span><EditButton label="tema og deltakere" onEdit={onEditSection ? () => onEditSection("deltakere") : undefined} /></dt><dd>{theme || "Ikke satt"}</dd></div>}
        {ageLabel && <div><dt>Alder</dt><dd>{ageLabel}</dd></div>}
        <div><dt>Varighet</dt><dd>{durationMinutes} min<small>Øvelser: {check.totalMinutes} min</small></dd></div>
        <div><dt>Forventede spillere</dt><dd>{plan.expectedPlayers ?? "Uavklart"}</dd></div>
        <div><dt>Planlagte trenere</dt><dd>{plan.confirmedCoaches ?? "Uavklart"}<small>Planforutsetning, ikke bekreftet oppmøte</small></dd></div>
        {plan.coachIds && <div><dt>Planlagte trenere</dt><dd>{plan.coachIds.length ? plan.coachIds.map((id) => coaches.find((coach) => coach.id === id)?.name ?? "Tidligere lagmedlem").join(", ") : "Ingen valgt"}</dd></div>}
      </dl>}
      <div className="session-outline">
        {objectives !== undefined && <section><div className="session-section-heading"><h2>Øvingsmål</h2><EditButton label="øvingsmål" onEdit={onEditSection ? () => onEditSection("ovingsmal") : undefined} /></div>{sectionEditor?.("ovingsmal") || <p className="preserve-lines">{objectives || "Ikke satt."}</p>}</section>}
        {plan.exercises.length > 0 ? <nav aria-label="Øktinnhold" className="session-contents">
          <h2>Øktinnhold</h2>
          {sections.map((section) => <div key={section.id}>
            <h3>{section.title} <small>{section.durationMinutes} min</small></h3>
            {section.exercises.length > 0 && <ul>{section.exercises.map(({ exercise, from }) => <li key={exercise.id}>
              <a href={`#${idPrefix}-ovelse-${exercise.id}`}>{exercise.title} <span>({exercise.durationMinutes} min)</span></a>
              <small>{from}–{from + exercise.durationMinutes} min</small>
            </li>)}</ul>}
          </div>)}
        </nav> : <p className="muted">Ingen øvelser er lagt til ennå.</p>}
      </div>
    </div>
    {sections.map((section) => <section className="session-stage" key={section.id} aria-labelledby={`${idPrefix}-${section.id}`}>
      <div className="stage-heading"><h2 id={`${idPrefix}-${section.id}`}>{section.title}</h2><div className="session-item-actions"><span>{section.durationMinutes} min</span>
        {onAdd && <button type="button" data-add-section={section.title} title={`Legg til øvelse i ${section.title}`} aria-label={`Legg til øvelse i ${section.title}`}
          disabled={addDisabled} onClick={(event) => onAdd(section.title === "Oppvarming" ? "warmup" : section.title === "Avslutning" ? "closing" : "theme", section.insertAt, event.currentTarget)}><Plus size={17} aria-hidden="true" /></button>}
      </div></div>
      {section.exercises.map(({ exercise, from, index }) => {
        const resources = exerciseResourceDetails(exercise);
        return <article className="session-exercise" id={`${idPrefix}-ovelse-${exercise.id}`} key={exercise.id}>
        <header className="exercise-heading">
          <div><small>{index + 1}. {stageLabels[exercise.stage]}</small><h3>{exercise.title}</h3></div>
          <div className="session-item-actions"><span className="exercise-duration">{exercise.durationMinutes} min<small>{from}–{from + exercise.durationMinutes} min</small></span>
            {onEdit && <button type="button" title={`Rediger ${exercise.title}`} aria-label={`Rediger ${exercise.title}`} onClick={() => onEdit(exercise.id)}><Pencil size={17} /></button>}
            {onRemove && <button type="button" title={`Slett ${exercise.title}`} aria-label={`Slett ${exercise.title}`} onClick={() => onRemove(exercise.id, exercise.title)}><Trash2 size={17} /></button>}
          </div>
        </header>
        <div className="exercise-body">
          {exerciseEditor?.(exercise.id) || <>
          {exercise.customExercise ? <div className="own-exercise-reader">
            <ExerciseContent exercise={{ ...exercise.customExercise, title: exercise.title, description: exercise.description, objectives: exercise.objectives }} />
          </div> : <p className="preserve-lines">{exercise.description || "Gjennomføring er ikke beskrevet ennå."}</p>}
          {(!exercise.customExercise || exercise.organization || exercise.coachingPoints || exercise.easier || exercise.harder || exercise.localAdaptations) && <details className="exercise-guidance">
            <summary>Målsetting, læringsmomenter, organisering og variasjoner</summary>
            <div className="exercise-guidance-grid">
              {([
                ["Målsetting", exercise.objectives], ["Læringsmomenter", exercise.coachingPoints],
                ["Organisering", exercise.organization],
              ] as const).map(([label, value]) => <section key={label}><h4>{label}</h4><p className="preserve-lines">{value || "Ikke beskrevet ennå."}</p></section>)}
              <section><h4>Variasjoner</h4>
                <p className="preserve-lines"><strong>Enklere: </strong>{exercise.easier || "Ikke beskrevet ennå."}</p>
                <p className="preserve-lines"><strong>Vanskeligere: </strong>{exercise.harder || "Ikke beskrevet ennå."}</p>
              </section>
              {exercise.localAdaptations && <section><h4>Lokale tilpasninger</h4><p className="preserve-lines">{exercise.localAdaptations}</p></section>}
            </div>
          </details>}
          {resources.hasEquipment && (resources.rows.length > 0 || exercise.sourceUrl) && <details className="exercise-guidance">
            <summary>Grupper, utstyr og kilde</summary>
            {resources.rows.length > 0 && <dl className="exercise-resources">{resources.rows.map(({ label, value }) =>
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
            {exercise.sourceUrl ? <p><AppLink href={exercise.sourceUrl}>Åpne øvelseskilden →</AppLink><br />
              <small>Oppgitt aldersmerking: {exercise.sourceAge || "ikke registrert"} · kontrollert av trener: {exercise.sourceCheckedOn || "ikke registrert"}.</small></p>
              : null}
          </details>}
          </>}
        </div>
      </article>; })}
    </section>)}
    {showLegacy && (plan.assumptions || plan.equipmentConfirmed || plan.availableBalls !== null || plan.availableSmallGoals !== null || plan.availableLargeGoals !== null) && <div className="session-coach-notes">
      <section>
        <h2>Tidligere registrerte rammer</h2>
        <p>Baller: {plan.availableBalls ?? "Uavklart"} · småmål: {plan.availableSmallGoals ?? "Uavklart"} · store mål: {plan.availableLargeGoals ?? "Uavklart"} · utstyr bekreftet: {plan.equipmentConfirmed ? "Ja" : "Nei"}.</p>
        {plan.assumptions && <p className="preserve-lines">{plan.assumptions}</p>}
      </section>
    </div>}
  </div>;
}
