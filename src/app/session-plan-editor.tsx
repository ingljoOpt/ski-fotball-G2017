"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkSessionPlan, coachSelectionChanged, stageLabels, type EventInput, type Exercise, type SessionPlan } from "@/lib/planning";
import { saveTrainingPlan } from "./actions";
import { minutesBetween, timeRangeSchema } from "@/lib/validation";
import { ActionButton, NativeInput, OptionSelect, SubmitButton, TextAreaInput, TextInput } from "./ui";
import { SessionAIChat } from "./session-ai-chat";
import { SessionPlanView } from "./session-plan-view";
import { sameAIDraft } from "@/lib/session-ai";
import { sessionHasEnded } from "@/lib/session-review";
import { useRouter } from "next/navigation";

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

export function SessionPlanEditor({ groupId, eventId, revision, initialEvent, initialPlan, coaches, ageLabel, initialDraft = false }: {
  groupId: string; eventId: string; revision: number; initialEvent: EventInput; initialPlan: SessionPlan; coaches: { id: string; name: string }[]; ageLabel?: string; initialDraft?: boolean;
}) {
  const [event, setEvent] = useState(initialEvent);
  const [plan, setPlan] = useState(initialPlan);
  const [origin, setOrigin] = useState<"manual" | "ai">("manual");
  const [state, action, pending] = useActionState(saveTrainingPlan, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const saveGenerated = useRef(false);
  const aiDraft = useMemo(() => ({ event, plan }), [event, plan]);
  const applyAIProposal = useCallback(({ draft }: { draft: { event: EventInput; plan: SessionPlan } }, save = false) => {
    saveGenerated.current = save;
    setEvent(draft.event);
    setPlan({ ...draft.plan, ...(draft.plan.coachIds ? { coachIdsForExercises: draft.plan.coachIds } : {}) });
    setOrigin("ai");
  }, []);
  useEffect(() => {
    if (!saveGenerated.current) return;
    saveGenerated.current = false;
    formRef.current?.requestSubmit();
  }, [event, plan]);
  useEffect(() => {
    if (!state?.error) return;
    const editor = document.getElementById("rediger-okt");
    if (editor instanceof HTMLDetailsElement) editor.open = true;
  }, [state]);
  useEffect(() => {
    const refreshIfEnded = () => { if (sessionHasEnded(initialEvent)) router.refresh(); };
    const timer = window.setInterval(refreshIfEnded, 30_000);
    document.addEventListener("visibilitychange", refreshIfEnded);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshIfEnded); };
  }, [initialEvent, router]);
  useEffect(() => {
    const form = formRef.current;
    // Server Action responses reset forms, including React Aria's controlled fields on validation errors.
    const preserveDraft = (event: Event) => event.preventDefault();
    form?.addEventListener("reset", preserveDraft, true);
    return () => form?.removeEventListener("reset", preserveDraft, true);
  }, []);
  const checks = checkSessionPlan(plan, event.durationMinutes);
  const needsRecalculation = coachSelectionChanged(plan);
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
  function edit(exerciseIds: string[]) {
    const editor = document.getElementById("rediger-okt");
    if (editor instanceof HTMLDetailsElement) editor.open = true;
    const targets = exerciseIds.map((id) => document.getElementById(`rediger-${id}`));
    targets.forEach((target) => { if (target instanceof HTMLDetailsElement) target.open = true; });
    (targets[0] ?? editor)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function remove(exerciseIds: string[], label: string) {
    if (!window.confirm(`Slette ${label}?`)) return;
    saveGenerated.current = !changed;
    setPlan((current) => ({ ...current, exercises: current.exercises.filter((exercise) => !exerciseIds.includes(exercise.id)) }));
    const editor = document.getElementById("rediger-okt");
    if (changed && editor instanceof HTMLDetailsElement) editor.open = true;
  }
  const changed = !sameAIDraft(aiDraft, { event: initialEvent, plan: initialPlan });
  return <>
    <SessionPlanView plan={plan} coaches={coaches} durationMinutes={event.durationMinutes} theme={event.theme} objectives={event.objectives}
      ageLabel={ageLabel} onEdit={pending ? undefined : edit} onRemove={pending ? undefined : remove} />
    {changed && <p className="notice" role="status">Endringene er ikke lagret. Lagre planen for å beholde dem.</p>}
    {pending && <p className="notice" role="status">Lagrer øktplanen …</p>}
    <div className="session-administration"><details id="rediger-okt" open={!initialPlan.exercises.length} className="plan-editor-details">
    <summary><h2>Rediger øktplanen</h2></summary>
    <div className="session-editor-layout"><form ref={formRef} action={action} className="session-editor" noValidate>
    <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
    <input type="hidden" name="revision" value={revision} /><input type="hidden" name="plan" value={JSON.stringify(plan)} />
    <input type="hidden" name="origin" value={origin} />
    {origin === "ai" && <p className="notice">Kontroller AI-planen før trening.</p>}
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
      <NativeInput label="Forventet antall spillere" type="number" min={0} max={500} step={1} value={plan.expectedPlayers ?? ""}
        onChange={(e) => setPlan({ ...plan, expectedPlayers: countValue(e.target.value) })} />
      <NativeInput label="Forventet antall trenere" type="number" min={0} max={500} step={1} value={plan.confirmedCoaches ?? ""}
        onChange={(e) => setPlan({ ...plan, confirmedCoaches: countValue(e.target.value), coachIds: undefined, coachAttendanceConfirmed: false,
          ...(plan.exercises.length && plan.coachIds ? { coachIdsForExercises: plan.coachIdsForExercises ?? plan.coachIds } : {}) })} />
    </div>
    <fieldset className="coach-selection"><legend>Planlagte trenere (valgfritt)</legend>
      {plan.coachIds === undefined && <p className="muted">Ingen trenere er valgt ved navn. Velg trenere for å bruke antallet i utvalget.</p>}
      {[...coaches, ...(plan.coachIds ?? []).filter((id) => !coaches.some((coach) => coach.id === id)).map((id) => ({ id, name: "Tidligere lagmedlem" }))].map((coach) =>
        <label key={coach.id}><input type="checkbox" checked={plan.coachIds?.includes(coach.id) ?? false} onChange={(event) => {
          const coachIds = event.target.checked ? [...(plan.coachIds ?? []), coach.id] : (plan.coachIds ?? []).filter((id) => id !== coach.id);
          setPlan({ ...plan, coachIds, confirmedCoaches: coachIds.length,
            ...(plan.exercises.length ? { coachIdsForExercises: plan.coachIdsForExercises ?? plan.coachIds ?? [] } : {}) });
        }} /> {coach.name}</label>)}
      <small>Utvalget er en planforutsetning, ikke dokumentasjon på faktisk oppmøte.</small>
      {needsRecalculation && <p className="notice">Trenerutvalget er endret. Øktassistenten kan beregne øvelsene på nytt.</p>}
    </fieldset>
    <TextAreaInput label="Trenerroller og øktansvar" rows={3} maxLength={8000} value={plan.coachRoles} onChange={(e) => setPlan({ ...plan, coachRoles: e.target.value })} />
    <h3>Øvelsesbygger</h3>
    <p>Legg til øvelser i ønsket rekkefølge. Oppgi tiden inkludert forklaring, pauser og bytter. Hvert kort er en sekvensiell blokk; alle samtidige flater inne i blokken telles samlet.</p>
    {plan.exercises.map((exercise, index) => <details id={`rediger-${exercise.id}`} className="exercise-detail" key={exercise.id}>
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
    {checks.warnings.length > 0 && <details><summary>Vis kontrollpunkter</summary><ul>{checks.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
    <div className="row">
      <SubmitButton isDisabled={pending}>Lagre øktplan</SubmitButton>
    </div>
    <small>Hver lagring bevarer den tidligere planen. Kontroller uavklarte punkter før trening.</small>
  </form><SessionAIChat groupId={groupId} eventId={eventId} revision={revision} draft={aiDraft} saving={pending} needsRecalculation={needsRecalculation}
    initialDraft={initialDraft}
    onApply={applyAIProposal} /></div></details></div>
  </>;
}
