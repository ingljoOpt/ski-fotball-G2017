import { checkSessionPlan, sessionSections, stageLabels, type SessionPlan } from "@/lib/planning";
import { Pencil, Trash2 } from "lucide-react";
import { AppLink } from "./ui";

export function SessionPlanView({ plan, coaches = [], durationMinutes, theme, objectives, ageLabel, idPrefix = "plan", showLegacy = false, onEdit, onRemove }: {
  plan: SessionPlan; coaches?: { userId: string; email: string }[]; durationMinutes: number; theme?: string; objectives?: string; ageLabel?: string; idPrefix?: string; showLegacy?: boolean;
  onEdit?: (exerciseIds: string[]) => void; onRemove?: (exerciseIds: string[], label: string) => void;
}) {
  const check = checkSessionPlan(plan, durationMinutes);
  const sections = sessionSections(plan.exercises);
  return <div className="session-plan">
    {plan.introduction && <p className="session-introduction preserve-lines">{plan.introduction}</p>}
    <div className="session-overview">
      <dl className="session-facts">
        {theme !== undefined && <div><dt>Tema</dt><dd>{theme || "Ikke satt"}</dd></div>}
        {ageLabel && <div><dt>Alder</dt><dd>{ageLabel}</dd></div>}
        <div><dt>Varighet</dt><dd>{durationMinutes} min<small>Øvelser: {check.totalMinutes} min</small></dd></div>
        <div><dt>Spillere / trenere</dt><dd>{plan.expectedPlayers ?? "Uavklart"} / {plan.confirmedCoaches ?? "Uavklart"}<small>Forventet / planlagt</small></dd></div>
        {plan.coachIds && <div><dt>Planlagte trenere</dt><dd>{plan.coachIds.length ? plan.coachIds.map((id) => coaches.find((coach) => coach.userId === id)?.email ?? "Tidligere lagmedlem").join(", ") : "Ingen valgt"}</dd></div>}
      </dl>
      <div className="session-outline">
        {objectives !== undefined && <section><h2>Øvingsmål</h2><p className="preserve-lines">{objectives || "Ikke satt."}</p></section>}
        {sections.length > 0 ? <nav aria-label="Øktinnhold" className="session-contents">
          <h2>Øktinnhold</h2>
          {sections.map((section) => <div key={section.id}>
            <h3>{section.title} <small>{section.durationMinutes} min</small></h3>
            <ul>{section.exercises.map(({ exercise, from }) => <li key={exercise.id}>
              <a href={`#${idPrefix}-ovelse-${exercise.id}`}>{exercise.title} <span>({exercise.durationMinutes} min)</span></a>
              <small>{from}–{from + exercise.durationMinutes} min</small>
            </li>)}</ul>
          </div>)}
        </nav> : <p className="muted">Ingen øvelser er lagt til ennå. Åpne øktbyggeren for å lage planen.</p>}
      </div>
    </div>
    {sections.map((section) => <section className="session-stage" key={section.id} aria-labelledby={`${idPrefix}-${section.id}`}>
      <div className="stage-heading"><h2 id={`${idPrefix}-${section.id}`}>{section.title}</h2><div className="session-item-actions"><span>{section.durationMinutes} min</span>
        {onEdit && <button type="button" title={`Rediger ${section.title}`} aria-label={`Rediger ${section.title}`} onClick={() => onEdit(section.exercises.map(({ exercise }) => exercise.id))}><Pencil size={17} /></button>}
        {onRemove && <button type="button" title={`Slett ${section.title}`} aria-label={`Slett ${section.title}`} onClick={() => onRemove(section.exercises.map(({ exercise }) => exercise.id), section.title)}><Trash2 size={17} /></button>}
      </div></div>
      {section.exercises.map(({ exercise, from, index }) => <article className="session-exercise" id={`${idPrefix}-ovelse-${exercise.id}`} key={exercise.id}>
        <header className="exercise-heading">
          <div><small>{index + 1}. {stageLabels[exercise.stage]}</small><h3>{exercise.title}</h3></div>
          <div className="session-item-actions"><span className="exercise-duration">{exercise.durationMinutes} min<small>{from}–{from + exercise.durationMinutes} min</small></span>
            {onEdit && <button type="button" title={`Rediger ${exercise.title}`} aria-label={`Rediger ${exercise.title}`} onClick={() => onEdit([exercise.id])}><Pencil size={17} /></button>}
            {onRemove && <button type="button" title={`Slett ${exercise.title}`} aria-label={`Slett ${exercise.title}`} onClick={() => onRemove([exercise.id], exercise.title)}><Trash2 size={17} /></button>}
          </div>
        </header>
        <div className="exercise-body">
          <p className="preserve-lines">{exercise.description || "Gjennomføring er ikke beskrevet ennå."}</p>
          <details className="exercise-guidance">
            <summary>Målsetting, læringsmomenter, organisering og variasjoner</summary>
            <div className="exercise-guidance-grid">
              {[
                ["Målsetting", exercise.objectives], ["Læringsmomenter", exercise.coachingPoints],
                ["Organisering", exercise.organization],
              ].map(([label, value]) => <section key={label}><h4>{label}</h4><p className="preserve-lines">{value || "Ikke beskrevet ennå."}</p></section>)}
              <section><h4>Variasjoner</h4>
                <p className="preserve-lines"><strong>Enklere: </strong>{exercise.easier || "Ikke beskrevet ennå."}</p>
                <p className="preserve-lines"><strong>Vanskeligere: </strong>{exercise.harder || "Ikke beskrevet ennå."}</p>
              </section>
              {exercise.localAdaptations && <section><h4>Lokale tilpasninger</h4><p className="preserve-lines">{exercise.localAdaptations}</p></section>}
            </div>
          </details>
          <details className="exercise-guidance">
            <summary>Grupper, utstyr og kilde</summary>
            <p>{exercise.simultaneousGroups ?? "Uavklart"} samtidige grupper · {exercise.assignedPlayers ?? "Uavklart"} spillere fordelt · {exercise.coaches ?? "Uavklart"} trenere.</p>
            <p>Totalt samtidig: {exercise.balls ?? "Uavklart"} aktive + {exercise.reserveBalls ?? "Uavklart"} reserveballer, {exercise.smallGoals ?? "Uavklart"} småmål, {exercise.largeGoals ?? "Uavklart"} store mål.</p>
            {exercise.sourceUrl ? <p><AppLink href={exercise.sourceUrl}>Åpne øvelseskilden →</AppLink><br />
              <small>Oppgitt aldersmerking: {exercise.sourceAge || "ikke registrert"} · kontrollert av trener: {exercise.sourceCheckedOn || "ikke registrert"}.</small></p>
              : <p className="muted">Ingen ekstern kilde er registrert.</p>}
          </details>
        </div>
      </article>)}
    </section>)}
    <div className="session-coach-notes">
      {[
        ["Trenerroller", plan.coachRoles],
        ["Alternativer ved endringer", plan.alternatives], ["Gjenbruk og progresjon", plan.progression],
      ].filter(([, value]) => value).map(([label, value]) => <section key={label}><h2>{label}</h2><p className="preserve-lines">{value}</p></section>)}
      <section><h2>Ressurskontroll</h2>
        <p>Største samtidige behov: {check.peak.balls ?? "Uavklart"} baller inkludert reserve · {check.peak.smallGoals ?? "Uavklart"} småmål · {check.peak.largeGoals ?? "Uavklart"} store mål · {check.peak.coaches ?? "Uavklart"} trenere.</p>
        <p className="muted">Tallene er toppbehov mellom sekvensielle blokker, ikke en sum gjennom økten. Treneren må kontrollere tilgjengelig utstyr mot klubbens og lagets instrukser.</p>
        {check.warnings.length > 0 ? <details className="notice error"><summary>{check.warnings.length} uavklarte kontrollpunkter</summary>
          <ul>{check.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details> : <p className="notice">Tallkontroll uten avvik. Trener må fortsatt kontrollere sikkerhet, kilder og om organiseringen fungerer i praksis.</p>}
      </section>
      {showLegacy && (plan.assumptions || plan.equipmentConfirmed || plan.availableBalls !== null || plan.availableSmallGoals !== null || plan.availableLargeGoals !== null) && <section>
        <h2>Tidligere registrerte rammer</h2>
        <p>Baller: {plan.availableBalls ?? "Uavklart"} · småmål: {plan.availableSmallGoals ?? "Uavklart"} · store mål: {plan.availableLargeGoals ?? "Uavklart"} · utstyr bekreftet: {plan.equipmentConfirmed ? "Ja" : "Nei"}.</p>
        {plan.assumptions && <p className="preserve-lines">{plan.assumptions}</p>}
      </section>}
    </div>
  </div>;
}
