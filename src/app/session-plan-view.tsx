import { checkSessionPlan, stageLabels, type SessionPlan } from "@/lib/planning";
import { AppLink } from "./ui";

export function SessionPlanView({ plan, durationMinutes }: { plan: SessionPlan; durationMinutes: number }) {
  const check = checkSessionPlan(plan, durationMinutes);
  return <div className="stack">
    {plan.introduction && <p className="lead preserve-lines">{plan.introduction}</p>}
    <dl className="plan-facts">
      <div><dt>Planlagt varighet</dt><dd>{durationMinutes} min · øvelser {check.totalMinutes} min</dd></div>
      <div><dt>Forventede spillere</dt><dd>{plan.expectedPlayers ?? "Ikke oppgitt"}</dd></div>
      <div><dt>Bekreftede trenere</dt><dd>{plan.confirmedCoaches ?? "Ikke oppgitt"}</dd></div>
      <div><dt>Utstyr bekreftet</dt><dd>{plan.equipmentConfirmed ? "Ja" : "Nei"}</dd></div>
    </dl>
    {plan.exercises.length > 0 && <section><h3>Øktoversikt</h3><ol className="session-timeline">
      {plan.exercises.map((exercise, index) => {
        const from = plan.exercises.slice(0, index).reduce((total, previous) => total + previous.durationMinutes, 0);
        return <li key={exercise.id}><strong>{from}–{from + exercise.durationMinutes} min</strong> · {exercise.title}<small> · {stageLabels[exercise.stage]}</small></li>;
      })}
    </ol></section>}
    {plan.exercises.map((exercise, index) => <details className="exercise-detail" key={exercise.id}>
      <summary><strong>{index + 1}. {exercise.title}</strong> · {exercise.durationMinutes} min · {stageLabels[exercise.stage]}</summary>
      {[
        ["Mål", exercise.objectives], ["Organisering", exercise.organization], ["Slik gjør dere det", exercise.description],
        ["Læringsmomenter", exercise.coachingPoints], ["Enklere variant", exercise.easier], ["Vanskeligere variant", exercise.harder],
        ["Lokale tilpasninger", exercise.localAdaptations],
      ].filter(([, value]) => value).map(([label, value]) => <section key={label}><h4>{label}</h4><p className="preserve-lines">{value}</p></section>)}
      <p>{exercise.simultaneousGroups ?? "Uavklart"} samtidige grupper · {exercise.assignedPlayers ?? "Uavklart"} spillere fordelt · {exercise.coaches ?? "Uavklart"} trenere.</p>
      <p>Totalt samtidig: {exercise.balls ?? "?"} aktive + {exercise.reserveBalls ?? "?"} reserveballer, {exercise.smallGoals ?? "?"} småmål, {exercise.largeGoals ?? "?"} store mål.</p>
      {exercise.sourceUrl && <p><AppLink href={exercise.sourceUrl}>Åpne øvelseskilden →</AppLink><br />
        <small>Oppgitt aldersmerking: {exercise.sourceAge || "ikke registrert"} · kontrollert av trener: {exercise.sourceCheckedOn || "ikke registrert"}.</small></p>}
    </details>)}
    {[
      ["Trenerroller", plan.coachRoles], ["Forutsetninger som må sjekkes", plan.assumptions],
      ["Alternativer ved endringer", plan.alternatives], ["Gjenbruk og progresjon", plan.progression],
    ].filter(([, value]) => value).map(([label, value]) => <section key={label}><h3>{label}</h3><p className="preserve-lines">{value}</p></section>)}
    <section><h3>Største samtidige behov</h3>
      <p>{check.peak.balls ?? "Uavklart"} baller inkludert reserve · {check.peak.smallGoals ?? "Uavklart"} småmål · {check.peak.largeGoals ?? "Uavklart"} store mål · {check.peak.coaches ?? "Uavklart"} trenere.</p>
      <p className="muted">Tallene er toppbehov mellom sekvensielle blokker, ikke en sum gjennom økten. Manglende tall vises i kontrollisten under.</p>
      {check.warnings.length > 0 ? <details className="notice error"><summary>{check.warnings.length} uavklarte kontrollpunkter</summary>
        <ul>{check.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </details> : <p className="notice">Tallkontroll uten avvik. Trener må fortsatt kontrollere sikkerhet, kilder og om organiseringen fungerer i praksis.</p>}
    </section>
  </div>;
}
