"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { checkSessionPlan, stageLabels, type EventInput, type Exercise, type SessionPlan } from "@/lib/planning";
import { saveTrainingPlan } from "./actions";
import { minutesBetween, timeRangeSchema } from "@/lib/validation";
import { ActionButton, NativeInput, OptionSelect, SubmitButton, TextAreaInput, TextInput } from "./ui";

const exerciseTexts = [
  ["objectives", "Mål for øvelsen"], ["organization", "Organisering, grupper, bane og rotasjon"],
  ["description", "Slik gjør dere det"], ["coachingPoints", "Læringsmomenter"],
  ["easier", "Enklere variant"], ["harder", "Vanskeligere variant"], ["localAdaptations", "Lokalt opplegg / tilpasninger fra kilden"],
] as const;
const resourceFields = [
  ["simultaneousGroups", "Antall samtidige grupper"], ["assignedPlayers", "Spillere fordelt totalt"],
  ["coaches", "Trenere som trengs"], ["balls", "Aktive baller totalt"], ["reserveBalls", "Reserveballer totalt"],
  ["smallGoals", "Småmål totalt"], ["largeGoals", "Store mål totalt"],
] as const;
const countValue = (value: string) => value === "" ? null : Number(value);

export function SessionPlanEditor({ groupId, eventId, revision, initialEvent, initialPlan }: {
  groupId: string; eventId: string; revision: number; initialEvent: EventInput; initialPlan: SessionPlan;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [plan, setPlan] = useState(initialPlan);
  const [state, action, pending] = useActionState(saveTrainingPlan, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    // Server Action responses reset forms, including React Aria's controlled fields on validation errors.
    const preserveDraft = (event: Event) => event.preventDefault();
    form?.addEventListener("reset", preserveDraft, true);
    return () => form?.removeEventListener("reset", preserveDraft, true);
  }, []);
  const checks = checkSessionPlan(plan, event.durationMinutes);
  const validTimeRange = timeRangeSchema.safeParse(event).success;
  function changeTime(field: "startTime" | "endTime", value: string) {
    setEvent((current) => {
      const next = { ...current, [field]: value };
      return { ...next, durationMinutes: timeRangeSchema.safeParse(next).success ? minutesBetween(next.startTime, next.endTime) : 0 };
    });
  }
  function changeExercise(index: number, patch: Partial<Exercise>) {
    setPlan((current) => ({ ...current, exercises: current.exercises.map((exercise, i) => i === index ? { ...exercise, ...patch } : exercise) }));
  }
  function addExercise(stage: Exercise["stage"]) {
    setPlan((current) => ({ ...current, exercises: [...current.exercises, {
      id: crypto.randomUUID(), stage, title: "Ny øvelse", durationMinutes: 10,
      objectives: "", organization: "", description: "", coachingPoints: "", easier: "", harder: "", localAdaptations: "",
      sourceUrl: "", sourceAge: "", sourceCheckedOn: "",
      simultaneousGroups: null, assignedPlayers: null, coaches: null, balls: null, reserveBalls: null, smallGoals: null, largeGoals: null,
    }] }));
  }
  function moveExercise(index: number, direction: -1 | 1) {
    setPlan((current) => {
      const exercises = [...current.exercises];
      [exercises[index], exercises[index + direction]] = [exercises[index + direction], exercises[index]];
      return { ...current, exercises };
    });
  }
  return <form ref={formRef} action={action} className="session-editor">
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
    <input type="hidden" name="revision" value={revision} /><input type="hidden" name="plan" value={JSON.stringify(plan)} />
    {state?.error && <p className="notice error" role="alert">{state.error}</p>}
    <h3>Øktens rammer</h3>
    <TextInput label="Økttittel" name="title" isRequired minLength={2} maxLength={150} value={event.title} onChange={(value) => setEvent({ ...event, title: value })} />
    <div className="form-grid">
      <NativeInput label="Dato" type="date" name="date" required value={event.date} onChange={(e) => setEvent({ ...event, date: e.target.value })} />
      <NativeInput label="Fra" type="time" name="startTime" required value={event.startTime} onChange={(e) => changeTime("startTime", e.target.value)} />
      <NativeInput label="Til" type="time" name="endTime" required value={event.endTime} onChange={(e) => changeTime("endTime", e.target.value)} />
    </div>
    <p role="status">{validTimeRange ? `Beregnet øktlengde: ${event.durationMinutes} minutter.` : "Oppgi fra og til med et tidsrom på 15–240 minutter."}</p>
    <small>En tidligere til-tid betyr neste dag.</small>
    <small>Alle tidspunkt er lokale i Europe/Oslo. Endret dato/tid flytter bare denne treningen, ikke ukerytmen.</small>
    <TextInput label="Hovedtema" name="theme" maxLength={150} value={event.theme} onChange={(value) => setEvent({ ...event, theme: value })} />
    <TextAreaInput label="Øktens øvingsmål" name="objectives" rows={3} maxLength={8000} value={event.objectives} onChange={(e) => setEvent({ ...event, objectives: e.target.value })} />
    <TextAreaInput label="Introduksjon og rød tråd" rows={3} maxLength={8000} value={plan.introduction} onChange={(e) => setPlan({ ...plan, introduction: e.target.value })} />
    <div className="form-grid">
      {([
        ["expectedPlayers", "Forventede spillere"], ["confirmedCoaches", "Bekreftede trenere"],
        ["availableBalls", "Tilgjengelige baller"], ["availableSmallGoals", "Tilgjengelige småmål"], ["availableLargeGoals", "Tilgjengelige store mål"],
      ] as const).map(([key, label]) => <NativeInput key={key} label={label} type="number" min={0} max={500} value={plan[key] ?? ""}
        onChange={(e) => setPlan({ ...plan, [key]: countValue(e.target.value) })} />)}
    </div>
    <OptionSelect label="Er utstyrsbeholdningen bekreftet?" value={plan.equipmentConfirmed ? "yes" : "no"}
      onChange={(value) => setPlan({ ...plan, equipmentConfirmed: value === "yes" })}
      options={[{ id: "no", label: "Nei – må avklares" }, { id: "yes", label: "Ja – antall er kontrollert" }]} />
    <TextAreaInput label="Forutsetninger og forhold som må sjekkes" rows={3} maxLength={8000} value={plan.assumptions} onChange={(e) => setPlan({ ...plan, assumptions: e.target.value })} />
    <TextAreaInput label="Trenerroller og øktansvar" rows={3} maxLength={8000} value={plan.coachRoles} onChange={(e) => setPlan({ ...plan, coachRoles: e.target.value })} />
    <h3>Øvelsesbygger</h3>
    <p>Legg til øvelser i ønsket rekkefølge. Oppgi tiden inkludert forklaring, pauser og bytter. Hvert kort er en sekvensiell blokk; alle samtidige flater inne i blokken telles samlet.</p>
    {plan.exercises.map((exercise, index) => <details open className="exercise-detail" key={exercise.id}>
      <summary>{index + 1}. {exercise.title} · {exercise.durationMinutes} min</summary>
      <div className="row">
        <ActionButton type="button" variant="secondary" size="sm" isDisabled={index === 0} onPress={() => moveExercise(index, -1)}>Flytt opp</ActionButton>
        <ActionButton type="button" variant="secondary" size="sm" isDisabled={index === plan.exercises.length - 1} onPress={() => moveExercise(index, 1)}>Flytt ned</ActionButton>
        <ActionButton type="button" variant="danger-soft" size="sm" onPress={() => setPlan({ ...plan, exercises: plan.exercises.filter((_, i) => i !== index) })}>Fjern øvelse</ActionButton>
      </div>
      <OptionSelect label="Øktdel" value={exercise.stage} options={Object.entries(stageLabels).map(([id, label]) => ({ id, label }))}
        onChange={(value) => {
          if (value === "warmup" || value === "theme" || value === "game" || value === "closing") changeExercise(index, { stage: value });
        }} />
      <TextInput label="Øvelsesnavn" maxLength={150} value={exercise.title} onChange={(value) => changeExercise(index, { title: value })} />
      <NativeInput label="Øvelsens minutter" type="number" min={1} max={240} value={exercise.durationMinutes} onChange={(e) => changeExercise(index, { durationMinutes: Number(e.target.value) })} />
      {exerciseTexts.map(([key, label]) => <TextAreaInput key={key} label={label} rows={3} maxLength={8000} value={exercise[key]}
        onChange={(e) => changeExercise(index, { [key]: e.target.value })} />)}
      <TextInput label="Kildelenke til Tiim / annen kilde" type="url" maxLength={2000} value={exercise.sourceUrl} onChange={(value) => changeExercise(index, { sourceUrl: value })} />
      <div className="form-grid">
        <TextInput label="Aldersmerking kontrollert i kilden" maxLength={100} value={exercise.sourceAge} onChange={(value) => changeExercise(index, { sourceAge: value })} />
        <NativeInput label="Kilde kontrollert dato" type="date" value={exercise.sourceCheckedOn} onChange={(e) => changeExercise(index, { sourceCheckedOn: e.target.value })} />
      </div>
      <p className="muted">Ikke kopier beskyttet tekst eller medier. Lenk til kilden og skriv egen beskrivelse. Alder og kontrolldato er trenerens opplysninger, ikke automatisk verifisering.</p>
      <div className="form-grid">{resourceFields.map(([key, label]) => <NativeInput key={key} label={label} type="number" min={0} max={500} value={exercise[key] ?? ""}
        onChange={(e) => changeExercise(index, { [key]: countValue(e.target.value) })} />)}</div>
    </details>)}
    <div className="row">{Object.entries(stageLabels).map(([stage, label]) => <ActionButton key={stage} type="button" variant="secondary" isDisabled={plan.exercises.length >= 30}
      onPress={() => {
        if (stage === "warmup" || stage === "theme" || stage === "game" || stage === "closing") addExercise(stage);
      }}>+ {label}</ActionButton>)}</div>
    <TextAreaInput label="Alternativer ved færre spillere, trenere, baller eller endrede forhold" rows={3} maxLength={8000} value={plan.alternatives} onChange={(e) => setPlan({ ...plan, alternatives: e.target.value })} />
    <TextAreaInput label="Gjenbruk, variasjon og neste progresjon" rows={3} maxLength={8000} value={plan.progression} onChange={(e) => setPlan({ ...plan, progression: e.target.value })} />
    <div className="notice" role="status">Tidsplan: {checks.totalMinutes} av {event.durationMinutes} minutter · {checks.warnings.length} uavklarte kontrollpunkter.</div>
    {checks.warnings.length > 0 && <details><summary>Vis kontrollpunkter før godkjenning</summary><ul>{checks.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
    <div className="row">
      <SubmitButton name="intent" value="draft" isDisabled={pending}>Lagre som utkast</SubmitButton>
      <SubmitButton name="intent" value="approve" variant="secondary" isDisabled={pending}>Godkjenn som planlagt</SubmitButton>
    </div>
    <small>Hver lagring lager en ny, uforanderlig planversjon. Utkast kan være ufullstendige. Godkjenning krever utfylte rammer og tallkontroll, men er ingen garanti for praktisk gjennomførbarhet.</small>
  </form>;
}
