import { checkSessionPlan, sessionSections, stageLabels, type SessionPlan } from "@/lib/planning";
import { AppLink } from "./ui";

export function SessionPlanView({ plan, durationMinutes, theme, objectives, ageLabel, idPrefix = "plan" }: {
  plan: SessionPlan; durationMinutes: number; theme?: string; objectives?: string; ageLabel?: string; idPrefix?: string;
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
        <div><dt>Spillere / trenere</dt><dd>{plan.expectedPlayers ?? "Uavklart"} / {plan.confirmedCoaches ?? "Uavklart"}<small>Forventet / bekreftet</small></dd></div>
        <div><dt>Utstyr bekreftet</dt><dd>{plan.equipmentConfirmed ? "Ja" : "Nei"}</dd></div>
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
      <div className="stage-heading"><h2 id={`${idPrefix}-${section.id}`}>{section.title}</h2><span>{section.durationMinutes} min</span></div>
      {section.exercises.map(({ exercise, from, index }) => <article className="session-exercise" id={`${idPrefix}-ovelse-${exercise.id}`} key={exercise.id}>
        <header className="exercise-heading">
          <div><small>{index + 1}. {stageLabels[exercise.stage]}</small><h3>{exercise.title}</h3></div>
          <span className="exercise-duration">{exercise.durationMinutes} min<small>{from}–{from + exercise.durationMinutes} min</small></span>
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
        ["Trenerroller", plan.coachRoles], ["Forutsetninger som må sjekkes", plan.assumptions],
        ["Alternativer ved endringer", plan.alternatives], ["Gjenbruk og progresjon", plan.progression],
      ].filter(([, value]) => value).map(([label, value]) => <section key={label}><h2>{label}</h2><p className="preserve-lines">{value}</p></section>)}
      <section><h2>Ressurskontroll</h2>
        <p>Største samtidige behov: {check.peak.balls ?? "Uavklart"} baller inkludert reserve · {check.peak.smallGoals ?? "Uavklart"} småmål · {check.peak.largeGoals ?? "Uavklart"} store mål · {check.peak.coaches ?? "Uavklart"} trenere.</p>
        <p className="muted">Tallene er toppbehov mellom sekvensielle blokker, ikke en sum gjennom økten.</p>
        {check.warnings.length > 0 ? <details className="notice error"><summary>{check.warnings.length} uavklarte kontrollpunkter</summary>
          <ul>{check.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details> : <p className="notice">Tallkontroll uten avvik. Trener må fortsatt kontrollere sikkerhet, kilder og om organiseringen fungerer i praksis.</p>}
      </section>
    </div>
  </div>;
}
