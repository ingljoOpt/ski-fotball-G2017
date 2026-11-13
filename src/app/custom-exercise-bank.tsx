"use client";

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import type { customExercises } from "@/db/schema";
import { videoEmbedUrl } from "@/lib/video-embed";
import { equipmentTypes, readEquipment, writeEquipment, type EquipmentItem } from "@/lib/exercise-equipment";
import tacticBoard from "../../publiserte/assets/taktikk.js";
import { saveOwnExercise } from "./actions";
import { ActionButton, Card, NativeInput, SubmitButton, TextAreaInput } from "./ui";
import { AnimationEditor } from "./animation-editor";

type Exercise = typeof customExercises.$inferSelect;
type Topic = { theme: string; sourceUrl: string };
const optionalFields = [
  ["theme", "Tema"], ["objectives", "Øvingsmål"], ["age", "Passende alder"],
  ["video", "Innbyggingslenke"], ["animations", "Animasjon"], ["equipment", "Utstyrskrav"],
] as const;
type OptionalField = typeof optionalFields[number][0];

function OptionalFieldGroup({ label, onRemove, disabled, children }: {
  label: string; onRemove: () => void; disabled?: boolean; children: ReactNode;
}) {
  return <div className="exercise-optional-field">
    <button type="button" className="button button--sm button--ghost exercise-optional-remove"
      aria-label={`Fjern ${label}`} title={`Fjern ${label}`} disabled={disabled} onClick={onRemove}>
      <Trash2 size={17} aria-hidden="true" />
    </button>
    {children}
  </div>;
}

function ageLabel(min: number | null, max: number | null) {
  if (min === null && max === null) return "";
  if (min === null) return `Til ${max} år`;
  if (max === null) return `Fra ${min} år`;
  return min === max ? `${min} år` : `${min}–${max} år`;
}

function AnimationPreview({ scene, index }: { scene: unknown; index: number }) {
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    try {
      const cleanup = tacticBoard.mountScene(element, scene);
      element.querySelector("svg.tactic-pitch")?.setAttribute("preserveAspectRatio", "xMinYMid meet");
      return cleanup;
    } catch (error) {
      console.error("Forhåndsvisning av animasjonen feilet:", error);
      element.querySelector("[data-tactic-canvas]")?.replaceChildren();
      const controls = element.querySelector<HTMLElement>("[data-tactic-controls]");
      if (controls) controls.hidden = true;
      const message = element.querySelector<HTMLElement>("[data-tactic-message]");
      if (message) {
        message.hidden = false;
        message.textContent = "Animasjonen kunne ikke vises. Åpne den i animasjonsbyggeren.";
      }
    }
  }, [scene]);
  return <figure className="exercise-animation-preview" ref={preview}>
    <figcaption>Forhåndsvisning · Animasjon {index + 1}</figcaption>
    <div data-tactic-canvas />
    <div className="exercise-animation-controls" data-tactic-controls hidden>
      <button type="button" className="button button--md button--secondary exercise-animation-icon" data-tactic-play data-playing="false"
        aria-label="Spill av animasjonen" title="Spill av">
        <Play className="preview-play" size={18} aria-hidden="true" />
        <Pause className="preview-pause" size={18} aria-hidden="true" />
      </button>
      <button type="button" className="button button--md button--secondary exercise-animation-icon" data-tactic-reset aria-label="Start animasjonen på nytt" title="Start på nytt">
        <RotateCcw size={18} aria-hidden="true" />
      </button>
      <span className="exercise-animation-step" data-tactic-step aria-live="polite" />
    </div>
    <p data-tactic-message role="status">Laster forhåndsvisning …</p>
  </figure>;
}

export function CustomExerciseBank({ groupId, basePath, exercises, topics }: {
  groupId: string; basePath: string; exercises: Exercise[]; topics: Topic[];
}) {
  const [creating, setCreating] = useState(false);
  return <>
    <ActionButton type="button" onPress={() => setCreating(true)}>Legg til øvelse</ActionButton>
    {exercises.length === 0 ? <p>Ingen egne øvelser ennå.</p> : <ul className="own-exercises-grid">
      {exercises.map((exercise) => <li key={exercise.id}>
        <Card className="app-card own-exercise-card">
        <h2>{exercise.title}</h2>
        {(ageLabel(exercise.ageMin, exercise.ageMax) || exercise.theme) && <p>{[ageLabel(exercise.ageMin, exercise.ageMax), exercise.theme].filter(Boolean).join(" · ")}</p>}
        <a className="button button--md button--secondary" href={`${basePath}/ovelser/${exercise.id}`}
          aria-label={`Vis ${exercise.title}`}>Vis</a>
        </Card>
      </li>)}
    </ul>}
    {creating && <ExerciseForm groupId={groupId} basePath={basePath}
      topics={topics} close={() => setCreating(false)} />}
  </>;
}

export function ExerciseReader({ exercise, basePath }: { exercise: Exercise; basePath: string }) {
  const [showVideo, setShowVideo] = useState(false);
  const embedUrl = videoEmbedUrl(exercise.videoUrl);
  const equipment = readEquipment(exercise.equipment);
  return <section className="own-exercise-reader" aria-label="Øvelsesbeskrivelse">
    <a href={`${basePath}/ovelser`}>← Til egne øvelser</a>
    {ageLabel(exercise.ageMin, exercise.ageMax) && <p><strong>Alder:</strong> {ageLabel(exercise.ageMin, exercise.ageMax)}</p>}
    {exercise.theme && <p><strong>Tema:</strong> {exercise.theme} {exercise.themeSource &&
      <a href={exercise.themeSource} target="_blank" rel="noreferrer">NFF-kilde</a>}</p>}
    {exercise.description && <><h2>Beskrivelse</h2><p className="exercise-description">{exercise.description}</p></>}
    {exercise.objectives && <><h2>Øvingsmål</h2><p className="exercise-description">{exercise.objectives}</p></>}
    {exercise.equipment && <section><h2>Utstyrskrav</h2>
      {equipment === null && <p role="alert">Det lagrede utstyret kunne ikke leses. Råteksten vises nedenfor.</p>}
      {(equipment?.legacy || equipment === null) && <p className="exercise-description">{equipment?.legacy ?? exercise.equipment}</p>}
      {equipment && equipment.items.length > 0 && <><p>Antall per gruppe:</p><ul>
        {equipment.items.map((item, index) => <li key={index}>{item.count} {item.type === "other" ? item.name : equipmentTypes.find(([type]) => type === item.type)?.[1].toLocaleLowerCase("nb")}</li>)}
      </ul></>}
    </section>}
    {exercise.animations.length > 0 && <section><h2>Animasjoner</h2>
      {exercise.animations.map((scene, index) => <AnimationPreview key={index} scene={scene} index={index} />)}
    </section>}
    {embedUrl && <section><h2>Video</h2>
      <ActionButton type="button" variant="secondary" onPress={() => setShowVideo(!showVideo)}>
        {showVideo ? "Skjul video" : "Vis video"}
      </ActionButton>
      {showVideo && <iframe className="exercise-video" title={`Video: ${exercise.title}`}
        src={embedUrl} allow="picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
    </section>}
  </section>;
}

export function ExerciseForm({ groupId, basePath, exercise, topics, close }: {
  groupId: string; basePath: string; exercise?: Exercise; topics: Topic[]; close?: () => void;
}) {
  const [values, setValues] = useState({
    title: exercise?.title ?? "", description: exercise?.description ?? "", theme: exercise?.theme ?? "",
    objectives: exercise?.objectives ?? "", ageMin: exercise?.ageMin?.toString() ?? "",
    ageMax: exercise?.ageMax?.toString() ?? "", videoUrl: exercise?.videoUrl ?? "",
  });
  const [equipment] = useState(() => readEquipment(exercise?.equipment ?? ""));
  const [equipmentLegacy, setEquipmentLegacy] = useState(equipment?.legacy ?? exercise?.equipment ?? "");
  const [showEquipmentLegacy, setShowEquipmentLegacy] = useState(Boolean(exercise?.equipment && (equipment === null || equipment.legacy)));
  const [equipmentWarning, setEquipmentWarning] = useState(equipment === null);
  const [equipmentItems, setEquipmentItems] = useState(() => (equipment?.items ?? []).map((item, id) => ({ ...item, id })));
  const nextEquipmentId = useRef(equipmentItems.length);
  const equipmentFocus = useRef<{ id: number } | { type: EquipmentItem["type"] } | null>(null);
  const [animations, setAnimations] = useState<unknown[]>(exercise?.animations ?? []);
  const [visible, setVisible] = useState<OptionalField[]>(() => [
    ...(exercise?.theme ? ["theme" as const] : []), ...(exercise?.objectives ? ["objectives" as const] : []),
    ...(exercise && (exercise.ageMin !== null || exercise.ageMax !== null) ? ["age" as const] : []),
    ...(exercise?.videoUrl ? ["video" as const] : []),
    ...(exercise?.equipment ? ["equipment" as const] : []),
  ]);
  const [showVideo, setShowVideo] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const focusAfterChange = useRef<{ field: OptionalField; target: "add" | "input" | "editor" } | null>(null);
  const topicListId = useId();
  const confirmedNavigation = useRef(false);
  const [state, action, pending] = useActionState(async (previous: { message: string; saved: boolean; id: string; revision: number }, form: FormData) => {
    const result = await saveOwnExercise(previous, form);
    if (result.saved) setDirty(false);
    return result;
  }, { message: "", saved: false, id: exercise?.id ?? "", revision: exercise?.revision ?? 0 });
  const router = useRouter();

  useEffect(() => {
    if (!exercise && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [exercise]);
  useEffect(() => {
    if (state.saved) {
      if (!exercise?.id) window.location.replace(`${basePath}/ovelser/${state.id}`);
      else router.refresh();
    }
  }, [state, router, exercise?.id, basePath]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (!confirmedNavigation.current && (dirty || editing !== null)) event.preventDefault(); }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, editing]);
  useEffect(() => {
    const focus = focusAfterChange.current;
    if (!focus) return;
    if (focus.target === "add") {
      const button = form.current?.querySelector<HTMLButtonElement>(`[data-add-field="${focus.field}"]`);
      (button ?? form.current?.querySelector<HTMLButtonElement>('button[type="submit"]'))?.focus();
    }
    else if (focus.target === "editor") form.current?.querySelector<HTMLElement>(".animation-editor")?.focus();
    else {
      const names = { theme: "theme", objectives: "objectives", age: "ageMin", video: "videoUrl", equipment: "", animations: "" };
      const selector = focus.field === "equipment" ? '[data-equipment-add="balls"]' : `[name="${names[focus.field]}"]`;
      form.current?.querySelector<HTMLElement>(selector)?.focus();
    }
    focusAfterChange.current = null;
  }, [visible, animations, editing]);
  useEffect(() => {
    const focus = equipmentFocus.current;
    if (!focus) return;
    const selector = "id" in focus ? `[data-equipment-item="${focus.id}"] input` : `[data-equipment-add="${focus.type}"]`;
    form.current?.querySelector<HTMLElement>(selector)?.focus();
    equipmentFocus.current = null;
  }, [equipmentItems]);
  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  function removeField(field: OptionalField, label: string) {
    const hasContent = {
      theme: Boolean(values.theme), objectives: Boolean(values.objectives),
      age: Boolean(values.ageMin || values.ageMax), video: Boolean(values.videoUrl),
      animations: animations.length > 0, equipment: Boolean(equipmentLegacy || equipmentItems.length),
    }[field];
    if (hasContent && !window.confirm(`Fjerne ${label.toLocaleLowerCase("nb")} og innholdet?`)) return;
    const cleared = {
      theme: { theme: "" }, objectives: { objectives: "" }, age: { ageMin: "", ageMax: "" },
      video: { videoUrl: "" }, animations: {}, equipment: {},
    }[field];
    setValues((current) => ({ ...current, ...cleared }));
    if (field === "animations") setAnimations([]);
    if (field === "video") setShowVideo(false);
    if (field === "equipment") { setEquipmentLegacy(""); setShowEquipmentLegacy(false); setEquipmentWarning(false); setEquipmentItems([]); }
    focusAfterChange.current = { field, target: "add" };
    setVisible((current) => current.filter((item) => item !== field));
    setDirty(true);
  }
  function closeForm() {
    if (pending) return;
    if ((dirty || editing !== null) && !window.confirm("Du kan ha ulagrede endringer. Lukk likevel?")) return;
    dialog.current?.close();
    close?.();
  }
  const content = <>
    <div className="row"><h2 id="own-exercise-title">{exercise ? "Rediger øvelse" : "Ny øvelse"}</h2>
      {exercise ? <a className="button button--md button--secondary" href={`${basePath}/ovelser/${exercise.id}`} onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if ((dirty || editing !== null) && !window.confirm("Du kan ha ulagrede endringer. Lukk likevel?")) event.preventDefault();
        else confirmedNavigation.current = true;
      }}>Tilbake til øvelsen</a> : null}</div>
    <form ref={form} action={action}>
      <fieldset disabled={pending} className="exercise-form-fields">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="id" value={state.id} />
      <input type="hidden" name="revision" value={state.revision} />
      <input type="hidden" name="animations" value={JSON.stringify(animations)} />
      <input type="hidden" name="equipment" value={visible.includes("equipment")
        ? writeEquipment({ legacy: equipmentLegacy, items: equipmentItems.map(({ type, name, count }) => ({ type, name, count })) }) : ""} />
      <NativeInput label="Navn på øvelsen" name="title" value={values.title} onChange={(event) => update("title", event.target.value)} autoFocus={!exercise} required maxLength={150} />
      <TextAreaInput label="Beskrivelse" name="description" value={values.description} onChange={(event) => update("description", event.target.value)} maxLength={8000} rows={4} />
      {visible.includes("theme") && <OptionalFieldGroup label="Tema" onRemove={() => removeField("theme", "Tema")}><NativeInput label="Tema" name="theme" list={topicListId} value={values.theme} onChange={(event) => update("theme", event.target.value)} maxLength={150} />
        <datalist id={topicListId}>{topics.map((topic) => <option key={topic.theme} value={topic.theme} />)}</datalist>
        <small>Velg et forslag fra tilgjengelige NFF-fagplaner, eller skriv inn eget tema.</small></OptionalFieldGroup>}
      {visible.includes("objectives") && <OptionalFieldGroup label="Øvingsmål" onRemove={() => removeField("objectives", "Øvingsmål")}><TextAreaInput label="Øvingsmål" name="objectives" value={values.objectives} onChange={(event) => update("objectives", event.target.value)} maxLength={8000} rows={3} /></OptionalFieldGroup>}
      {visible.includes("age") && <OptionalFieldGroup label="Passende alder" onRemove={() => removeField("age", "Passende alder")}><div className="inline-form">
        <NativeInput label="Alder fra" name="ageMin" type="number" min={3} max={100} value={values.ageMin} onChange={(event) => update("ageMin", event.target.value)} />
        <NativeInput label="Alder til" name="ageMax" type="number" min={3} max={100} value={values.ageMax} onChange={(event) => update("ageMax", event.target.value)} />
      </div></OptionalFieldGroup>}
      {visible.includes("video") && <OptionalFieldGroup label="Innbyggingslenke" onRemove={() => removeField("video", "Innbyggingslenke")}><NativeInput label="Videolenke fra YouTube eller Vimeo" name="videoUrl" type="url" maxLength={2000}
        value={values.videoUrl} onChange={(event) => { update("videoUrl", event.target.value); setShowVideo(false); }} />
        {videoEmbedUrl(values.videoUrl) && <><ActionButton type="button" variant="secondary" onPress={() => setShowVideo(!showVideo)}>{showVideo ? "Skjul forhåndsvisning" : "Vis forhåndsvisning"}</ActionButton>
          {showVideo && <iframe className="exercise-video" title="Forhåndsvisning av video" src={videoEmbedUrl(values.videoUrl) ?? undefined} allow="picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}</>}</OptionalFieldGroup>}
      {visible.includes("equipment") && <OptionalFieldGroup label="Utstyrskrav" onRemove={() => removeField("equipment", "Utstyrskrav")}>
        <fieldset><legend>Utstyrskrav</legend>
          <p>Oppgi antall per gruppe i øvelsen.</p>
          {equipmentWarning && <p role="alert">Det lagrede utstyret kunne ikke leses. Kontroller den tidligere utstyrsteksten.</p>}
          {showEquipmentLegacy && <TextAreaInput label="Tidligere utstyrstekst" value={equipmentLegacy} onChange={(event) => {
            setEquipmentLegacy(event.target.value); setEquipmentWarning(false); setDirty(true);
          }} maxLength={8000} rows={3} />}
          {equipmentItems.map((item) => {
            const label = equipmentTypes.find(([type]) => type === item.type)?.[1] ?? "Annet";
            return <div key={item.id} data-equipment-item={item.id} className="exercise-equipment-item">
              {item.type === "other" ? <NativeInput label="Navn på annet utstyr" value={item.name} required maxLength={150}
                onChange={(event) => { setEquipmentItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry)); setDirty(true); }} />
                : <strong>{label}</strong>}
              <NativeInput label={`Antall ${item.type === "other" ? "for annet utstyr" : label.toLocaleLowerCase("nb")} per gruppe`}
                type="number" min={1} step={1} required value={item.count}
                onChange={(event) => { setEquipmentItems((items) => items.map((entry) => entry.id === item.id ? { ...entry, count: event.target.value } : entry)); setDirty(true); }} />
              <button type="button" className="button button--sm button--ghost exercise-equipment-remove"
                aria-label={`Fjern ${item.type === "other" && item.name ? item.name : label}`} onClick={() => {
                  if ((item.name || item.count) && !window.confirm(`Fjerne ${item.type === "other" && item.name ? item.name : label.toLocaleLowerCase("nb")}?`)) return;
                  equipmentFocus.current = { type: item.type };
                  setEquipmentItems((items) => items.filter((entry) => entry.id !== item.id)); setDirty(true);
                }}><Trash2 size={17} aria-hidden="true" /></button>
            </div>;
          })}
          <div className="exercise-add-fields">
            {equipmentTypes.filter(([type]) => type === "other" || !equipmentItems.some((item) => item.type === type)).map(([type, label]) =>
              <button key={type} type="button" className="button button--md button--secondary" data-equipment-add={type} onClick={() => {
                const id = nextEquipmentId.current++;
                equipmentFocus.current = { id };
                setEquipmentItems((items) => [...items, { id, type, name: "", count: "" }]); setDirty(true);
              }}>+ {label}</button>)}
          </div>
        </fieldset>
      </OptionalFieldGroup>}
      {animations.length > 0 && <OptionalFieldGroup label="Animasjoner" disabled={editing !== null} onRemove={() => removeField("animations", "Animasjoner")}><fieldset><legend>Animasjoner</legend>
        {animations.map((scene, index) => <div key={index}>
          <AnimationPreview scene={scene} index={index} />
          <div><ActionButton type="button" variant="secondary" isDisabled={editing !== null} onPress={() => setEditing(index)}>Åpne i animasjonsbygger</ActionButton>{" "}
            <ActionButton type="button" variant="secondary" isDisabled={editing !== null} onPress={() => {
              if (window.confirm("Fjerne animasjonen fra øvelsen?")) {
                focusAfterChange.current = { field: "animations", target: "add" };
                setAnimations((items) => items.filter((_, i) => i !== index)); setDirty(true);
              }
            }}>Fjern</ActionButton></div>
        </div>)}
      </fieldset></OptionalFieldGroup>}
      {editing !== null && <div>
        <p>Bygg animasjonen og velg «Lagre». Husk deretter å lagre øvelsen.</p>
        <AnimationEditor key={editing} initialScene={animations[editing]} onSave={(scene) => {
          setAnimations((current) => editing === current.length ? [...current, scene] : current.map((item, index) => index === editing ? scene : item));
          focusAfterChange.current = { field: "animations", target: "add" };
          setDirty(true);
          setEditing(null);
        }} onCancel={() => {
          if (window.confirm("Lukk animasjonsbyggeren uten å bruke endringene?")) {
            focusAfterChange.current = { field: "animations", target: "add" };
            setEditing(null);
          }
        }} />
      </div>}
      {state.message && <p className={state.saved ? "notice" : "notice error"} role={state.saved ? "status" : "alert"}>{state.message}</p>}
      <div className="exercise-add-fields">
        {optionalFields.filter(([key]) => key === "animations" ? animations.length < 10 : !visible.includes(key)).map(([key, label]) =>
          <button key={key} type="button" className="button button--md button--secondary" data-add-field={key}
            disabled={key === "animations" && editing !== null} onClick={() => {
              focusAfterChange.current = { field: key, target: key === "animations" ? "editor" : "input" };
              if (key === "animations") setEditing(animations.length);
              else setVisible((current) => [...current, key]);
            }}>+ {label}</button>)}
      </div>
      <div className="exercise-form-actions"><SubmitButton isDisabled={editing !== null}>Lagre øvelse</SubmitButton>
        {!exercise && <ActionButton type="button" variant="secondary" isDisabled={pending} onPress={closeForm}>Lukk</ActionButton>}</div>
      {editing !== null && <small>Lagre eller avbryt animasjonsredigeringen før du lagrer øvelsen.</small>}
      </fieldset>
    </form>
  </>;
  return exercise ? <section className="custom-exercise-form" aria-labelledby="own-exercise-title">{content}</section>
    : <dialog ref={dialog} className="training-time-dialog custom-exercise-form custom-exercise-dialog" aria-labelledby="own-exercise-title"
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); closeForm(); } }}
      onCancel={(event) => { event.preventDefault(); closeForm(); }}>{content}</dialog>;
}
