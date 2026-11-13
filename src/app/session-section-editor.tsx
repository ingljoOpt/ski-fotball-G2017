"use client";

import { useEffect, useId, useRef, useState } from "react";
import { coachSelectionChanged, eventSchema, sessionPlanSchema, stageLabels, type EventInput, type Exercise, type SessionPlan } from "@/lib/planning";
import { minutesBetween, timeRangeSchema } from "@/lib/validation";
import { ActionButton, NativeInput, OptionSelect, TextAreaInput, TextInput } from "./ui";
import type { EditSection } from "./session-plan-view";

const exerciseTexts = [
  ["objectives", "Målsetting"], ["organization", "Organisering, grupper, bane og rotasjon"],
  ["description", "Slik gjør dere det"], ["coachingPoints", "Læringsmomenter"],
  ["easier", "Enklere variant"], ["harder", "Vanskeligere variant"], ["localAdaptations", "Lokalt opplegg / tilpasninger fra kilden"],
] as const;
const resourceFields = [
  ["simultaneousGroups", "Antall samtidige grupper"], ["assignedPlayers", "Spillere fordelt totalt"],
  ["coaches", "Trenere som trengs"], ["balls", "Aktive baller totalt"], ["reserveBalls", "Reserveballer totalt"],
  ["smallGoals", "Småmål totalt"], ["largeGoals", "Store mål totalt"],
] as const;
const countValue = (value: string) => value === "" ? null : Number(value);

export function SessionSectionEditor({ section, exerciseId, isNew = false, event, plan, coaches, onSave, onCancel }: {
  section?: EditSection; exerciseId?: string; event: EventInput; plan: SessionPlan; coaches: { id: string; name: string }[];
  isNew?: boolean;
  onSave: (event: EventInput, plan: SessionPlan) => void; onCancel: () => void;
}) {
  const [draftEvent, setEvent] = useState(event);
  const [draftPlan, setPlan] = useState(plan);
  const [error, setError] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const stageId = useId();
  useEffect(() => { form.current?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), textarea:not(:disabled), button:not(:disabled)")?.focus({ preventScroll: !isNew }); }, [isNew]);
  const index = draftPlan.exercises.findIndex((exercise) => exercise.id === exerciseId);
  const exercise = draftPlan.exercises[index];
  const initialStage = plan.exercises.find((item) => item.id === exerciseId)?.stage;
  const validTimeRange = timeRangeSchema.safeParse(draftEvent).success;
  function changeTime(field: "startTime" | "endTime", value: string) {
    setEvent((current) => {
      const next = { ...current, [field]: value };
      return { ...next, durationMinutes: timeRangeSchema.safeParse(next).success ? minutesBetween(next.startTime, next.endTime) : 0 };
    });
  }
  function changeExercise(patch: Partial<Exercise>) {
    setPlan((current) => ({ ...current, exercises: current.exercises.map((item) => item.id === exerciseId ? { ...item, ...patch } : item) }));
  }
  function moveExercise(direction: -1 | 1) {
    setPlan((current) => {
      const exercises = [...current.exercises];
      [exercises[index], exercises[index + direction]] = [exercises[index + direction], exercises[index]];
      return { ...current, exercises };
    });
  }
  return <form ref={form} className="session-inline-editor" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
    onSubmit={(e) => {
      e.preventDefault();
      const parsedEvent = eventSchema.safeParse(draftEvent);
      const parsedPlan = sessionPlanSchema.safeParse(draftPlan);
      if (!parsedEvent.success || !parsedPlan.success) {
        setError([...(parsedEvent.success ? [] : parsedEvent.error.issues), ...(parsedPlan.success ? [] : parsedPlan.error.issues)].map((issue) => issue.message).join(" "));
        return;
      }
      onSave({ ...draftEvent, ...parsedEvent.data }, parsedPlan.data);
    }}>
    {section === "rammer" && <>
      <TextInput label="Økttittel" isRequired minLength={2} maxLength={150} value={draftEvent.title} onChange={(title) => setEvent({ ...draftEvent, title })} />
      <div className="form-grid">
        <NativeInput label="Dato" type="date" required value={draftEvent.date} onChange={(e) => setEvent({ ...draftEvent, date: e.target.value })} />
        <NativeInput label="Fra" type="time" required value={draftEvent.startTime} onChange={(e) => changeTime("startTime", e.target.value)} />
        <NativeInput label="Til" type="time" required value={draftEvent.endTime} onChange={(e) => changeTime("endTime", e.target.value)} />
      </div>
      <p role="status">{validTimeRange ? `Beregnet øktlengde: ${draftEvent.durationMinutes} minutter.` : "Oppgi fra og til med et tidsrom på 15–240 minutter."}</p>
      <small>En tidligere til-tid betyr neste dag. Tidspunktene er lokale i Europe/Oslo. Endret dato/tid flytter bare denne treningen.</small>
    </>}
    {section === "deltakere" && <>
      <TextInput label="Hovedtema" maxLength={150} value={draftEvent.theme} onChange={(theme) => setEvent({ ...draftEvent, theme })} />
      <div className="form-grid">
        <NativeInput label="Forventet antall spillere" type="number" min={0} max={500} step={1} value={draftPlan.expectedPlayers ?? ""}
          onChange={(e) => setPlan({ ...draftPlan, expectedPlayers: countValue(e.target.value) })} />
        <NativeInput label="Forventet antall trenere" type="number" min={0} max={500} step={1} value={draftPlan.confirmedCoaches ?? ""}
          onChange={(e) => setPlan({ ...draftPlan, confirmedCoaches: countValue(e.target.value), coachIds: undefined, coachAttendanceConfirmed: false,
            ...(draftPlan.exercises.length && draftPlan.coachIds ? { coachIdsForExercises: draftPlan.coachIdsForExercises ?? draftPlan.coachIds } : {}) })} />
      </div>
      <fieldset className="coach-selection"><legend>Planlagte trenere (valgfritt)</legend>
        {draftPlan.coachIds === undefined && <p className="muted">Ingen trenere er valgt ved navn. Velg trenere for å bruke antallet i utvalget.</p>}
        {[...coaches, ...(draftPlan.coachIds ?? []).filter((id) => !coaches.some((coach) => coach.id === id)).map((id) => ({ id, name: "Tidligere lagmedlem" }))].map((coach) =>
          <label key={coach.id}><input type="checkbox" checked={draftPlan.coachIds?.includes(coach.id) ?? false} onChange={(e) => {
            const coachIds = e.target.checked ? [...(draftPlan.coachIds ?? []), coach.id] : (draftPlan.coachIds ?? []).filter((id) => id !== coach.id);
            setPlan({ ...draftPlan, coachIds, confirmedCoaches: coachIds.length,
              ...(draftPlan.exercises.length ? { coachIdsForExercises: draftPlan.coachIdsForExercises ?? draftPlan.coachIds ?? [] } : {}) });
          }} /> {coach.name}</label>)}
        <small>Utvalget er en planforutsetning, ikke dokumentasjon på faktisk oppmøte.</small>
        {coachSelectionChanged(draftPlan) && <p className="notice">Trenerutvalget er endret. Øktassistenten kan beregne øvelsene på nytt.</p>}
      </fieldset>
    </>}
    {section === "ovingsmal" && <TextAreaInput label="Øktens øvingsmål" rows={3} maxLength={8000} value={draftEvent.objectives} onChange={(e) => setEvent({ ...draftEvent, objectives: e.target.value })} />}
    {section === "introduksjon" && <TextAreaInput label="Introduksjon og rød tråd" rows={3} maxLength={8000} value={draftPlan.introduction} onChange={(e) => setPlan({ ...draftPlan, introduction: e.target.value })} />}
    {exercise && <>
      {!isNew && <div className="row">
        <ActionButton type="button" variant="secondary" isDisabled={index === 0} onPress={() => moveExercise(-1)}>Flytt opp</ActionButton>
        <ActionButton type="button" variant="secondary" isDisabled={index === draftPlan.exercises.length - 1} onPress={() => moveExercise(1)}>Flytt ned</ActionButton>
      </div>}
      {isNew ? <div className="app-field"><label htmlFor={stageId}>Øktdel</label>
        <select id={stageId} value={exercise.stage} onChange={(event) => {
          const value = event.target.value;
          if (value === "warmup" || value === "theme" || value === "game" || value === "closing") changeExercise({ stage: value });
        }}>
          {Object.entries(stageLabels).filter(([id]) => id === initialStage || (initialStage === "theme" && id === "game"))
            .map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div> : <OptionSelect label="Øktdel" value={exercise.stage} options={Object.entries(stageLabels).map(([id, label]) => ({ id, label }))}
        onChange={(value) => { if (value === "warmup" || value === "theme" || value === "game" || value === "closing") changeExercise({ stage: value }); }} />}
      <TextInput label="Øvelsesnavn" isRequired maxLength={150} value={exercise.title} onChange={(title) => changeExercise({ title })} />
      <NativeInput label="Øvelsens minutter" type="number" required min={1} max={240} value={exercise.durationMinutes} onChange={(e) => changeExercise({ durationMinutes: Number(e.target.value) })} />
      {exerciseTexts.map(([key, label]) => <TextAreaInput key={key} label={label} rows={3} maxLength={8000} value={exercise[key]}
        onChange={(e) => changeExercise({ [key]: e.target.value })} />)}
      <TextInput label="Kildelenke til Tiim / annen kilde" type="url" maxLength={2000} value={exercise.sourceUrl} onChange={(sourceUrl) => changeExercise({ sourceUrl })} />
      <div className="form-grid">
        <TextInput label="Aldersmerking kontrollert i kilden" maxLength={100} value={exercise.sourceAge} onChange={(sourceAge) => changeExercise({ sourceAge })} />
        <NativeInput label="Kilde kontrollert dato" type="date" value={exercise.sourceCheckedOn} onChange={(e) => changeExercise({ sourceCheckedOn: e.target.value })} />
      </div>
      <p className="muted">Ikke kopier beskyttet tekst eller medier. Alder og kontrolldato er trenerens opplysninger, ikke automatisk verifisering.</p>
      <label><input type="checkbox" checked={exercise.noSpecialResources ?? false}
        onChange={(e) => changeExercise({ noSpecialResources: e.target.checked })} /> Ingen særskilt gruppeinndeling eller utstyr trengs</label>
      <p className="muted">Velg bare når aktiviteten ikke krever særskilte grupper, baller eller mål. Oppgitte gruppe- og utstyrstall må da være tomme eller null.</p>
      <div className="form-grid">{resourceFields.map(([key, label]) => <NativeInput key={key} label={label} type="number" min={0} max={500} step={1} value={exercise[key] ?? ""}
        onChange={(e) => changeExercise({ [key]: countValue(e.target.value) })} />)}</div>
    </>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="row"><ActionButton type="submit">Lagre</ActionButton><ActionButton type="button" variant="secondary" onPress={onCancel}>Avbryt</ActionButton></div>
  </form>;
}
