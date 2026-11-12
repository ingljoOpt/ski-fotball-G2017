"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { customExercises } from "@/db/schema";
import { videoEmbedUrl } from "@/lib/video-embed";
import tacticBoard from "../../publiserte/assets/taktikk.js";
import { saveOwnExercise } from "./actions";
import { ActionButton, Card, NativeInput, SubmitButton, TextAreaInput } from "./ui";

type Exercise = typeof customExercises.$inferSelect;
type Topic = { id: string; theme: string; sourceUrl: string };

function AnimationPreview({ scene, index }: { scene: unknown; index: number }) {
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    try {
      return tacticBoard.mountScene(element, scene);
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
      <button type="button" className="button button--md button--secondary" data-tactic-play data-playing="false"
        aria-label="Spill av animasjonen">
        <span className="preview-play">Spill av</span><span className="preview-pause">Pause</span>
      </button>
      <button type="button" className="button button--md button--secondary" data-tactic-reset aria-label="Start animasjonen på nytt">
        Start på nytt
      </button>
      <span className="exercise-animation-step" data-tactic-step aria-live="polite" />
    </div>
    <p data-tactic-message role="status">Laster forhåndsvisning …</p>
  </figure>;
}

export function CustomExerciseBank({ groupId, basePath, exercises, topics, age }: {
  groupId: string; basePath: string; exercises: Exercise[]; topics: Topic[]; age: number | null;
}) {
  const [creating, setCreating] = useState(false);
  return <>
    {!creating && <ActionButton type="button" onPress={() => setCreating(true)}>Legg til øvelse</ActionButton>}
    {exercises.length === 0 ? <p>Ingen egne øvelser ennå.</p> : <ul className="own-exercises-grid">
      {exercises.map((exercise) => <li key={exercise.id}>
        <Card className="app-card own-exercise-card">
        <h2>{exercise.title}</h2>
        <p>{exercise.ageMin === exercise.ageMax ? `${exercise.ageMin} år` : `${exercise.ageMin}–${exercise.ageMax} år`}
          {exercise.theme && <> · {exercise.theme}</>}</p>
        <a className="button button--md button--secondary" href={`${basePath}/ovelser/${exercise.id}`}
          aria-label={`Vis ${exercise.title}`}>Vis</a>
        </Card>
      </li>)}
    </ul>}
    {creating && <ExerciseForm groupId={groupId} basePath={basePath}
      topics={topics} age={age} close={() => setCreating(false)} />}
  </>;
}

export function ExerciseReader({ exercise, basePath, canEdit }: { exercise: Exercise; basePath: string; canEdit: boolean }) {
  const [showVideo, setShowVideo] = useState(false);
  const embedUrl = videoEmbedUrl(exercise.videoUrl);
  return <section className="own-exercise-reader" aria-label="Øvelsesbeskrivelse">
    <div className="row">
      <a href={`${basePath}/ovelser`}>← Til egne øvelser</a>
      {canEdit && <a className="button button--md button--secondary" href={`${basePath}/ovelser/${exercise.id}/rediger`}>Rediger</a>}
    </div>
    <p><strong>Alder:</strong> {exercise.ageMin === exercise.ageMax ? `${exercise.ageMin} år` : `${exercise.ageMin}–${exercise.ageMax} år`}</p>
    {exercise.theme && <p><strong>Tema:</strong> {exercise.theme} {exercise.themeSource &&
      <a href={exercise.themeSource} target="_blank" rel="noreferrer">NFF-kilde</a>}</p>}
    {exercise.description && <><h2>Beskrivelse</h2><p className="exercise-description">{exercise.description}</p></>}
    {exercise.objectives && <><h2>Øvingsmål</h2><p className="exercise-description">{exercise.objectives}</p></>}
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

export function ExerciseForm({ groupId, basePath, exercise, topics, age, close }: {
  groupId: string; basePath: string; exercise?: Exercise; topics: Topic[]; age: number | null; close?: () => void;
}) {
  const previousKey = exercise?.theme ? JSON.stringify([exercise.theme, exercise.themeSource]) : "";
  const initialTopic = topics.find((topic) => topic.theme === exercise?.theme && topic.sourceUrl === exercise?.themeSource);
  const [values, setValues] = useState({
    title: exercise?.title ?? "", description: exercise?.description ?? "", theme: initialTopic?.id ?? previousKey,
    objectives: exercise?.objectives ?? "", ageMin: String(exercise?.ageMin ?? (age !== null && age >= 3 && age <= 100 ? age : 8)),
    ageMax: String(exercise?.ageMax ?? (age !== null && age >= 3 && age <= 100 ? age : 9)), videoUrl: exercise?.videoUrl ?? "",
  });
  const [animations, setAnimations] = useState<unknown[]>(exercise?.animations ?? []);
  const [editing, setEditing] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const confirmedNavigation = useRef(false);
  const [state, action, pending] = useActionState(async (previous: { message: string; saved: boolean; id: string; revision: number }, form: FormData) => {
    const result = await saveOwnExercise(previous, form);
    if (result.saved) setDirty(false);
    return result;
  }, { message: "", saved: false, id: exercise?.id ?? "", revision: exercise?.revision ?? 0 });
  const router = useRouter();

  useEffect(() => {
    if (state.saved) {
      if (!exercise?.id) window.location.replace(`${basePath}/ovelser/${state.id}`);
      else router.refresh();
    }
  }, [state, router, exercise?.id, basePath]);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== "exercise-save-scene" || editing === null) return;
      setAnimations((current) => editing === current.length ? [...current, event.data.scene] : current.map((item, index) => index === editing ? event.data.scene : item));
      setDirty(true);
      setEditing(null);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [editing]);
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) { if (!confirmedNavigation.current && (dirty || editing !== null)) event.preventDefault(); }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, editing]);
  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  function closeForm() {
    if ((dirty || editing !== null) && !window.confirm("Du kan ha ulagrede endringer. Lukk likevel?")) return;
    close?.();
  }
  return <section className="custom-exercise-form" aria-labelledby="own-exercise-title">
    <div className="row"><h2 id="own-exercise-title">{exercise ? "Rediger øvelse" : "Ny øvelse"}</h2>
      {exercise ? <a className="button button--md button--secondary" href={`${basePath}/ovelser/${exercise.id}`} onClick={(event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if ((dirty || editing !== null) && !window.confirm("Du kan ha ulagrede endringer. Lukk likevel?")) event.preventDefault();
        else confirmedNavigation.current = true;
      }}>Tilbake til øvelsen</a> : <ActionButton type="button" variant="secondary" onPress={closeForm}>Lukk</ActionButton>}</div>
    <form action={action}>
      <fieldset disabled={pending} className="exercise-form-fields">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="id" value={state.id} />
      <input type="hidden" name="revision" value={state.revision} />
      <input type="hidden" name="animations" value={JSON.stringify(animations)} />
      <NativeInput label="Navn på øvelsen" name="title" value={values.title} onChange={(event) => update("title", event.target.value)} required maxLength={150} />
      <TextAreaInput label="Beskrivelse" name="description" value={values.description} onChange={(event) => update("description", event.target.value)} maxLength={8000} rows={4} />
      <label className="app-field">Tema fra NFF for lagets alder (valgfritt)
        <select name="theme" value={values.theme} onChange={(event) => update("theme", event.target.value)}>
          <option value="">Ingen tema</option>
          {!initialTopic && previousKey && <option value={previousKey}>{exercise?.theme} (tidligere valgt)</option>}
          {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.theme}</option>)}
        </select>
      </label>
      {!topics.length && <small>Ingen lagret NFF-fagplan for lagets alder. Oppdater fagplanen i årsplanen for å velge tema.</small>}
      <TextAreaInput label="Øvingsmål (valgfritt)" name="objectives" value={values.objectives} onChange={(event) => update("objectives", event.target.value)} maxLength={8000} rows={3} />
      <div className="inline-form">
        <NativeInput label="Alder fra" name="ageMin" type="number" min={3} max={100} required value={values.ageMin} onChange={(event) => update("ageMin", event.target.value)} />
        <NativeInput label="Alder til" name="ageMax" type="number" min={3} max={100} required value={values.ageMax} onChange={(event) => update("ageMax", event.target.value)} />
      </div>
      <NativeInput label="Videolenke fra YouTube eller Vimeo (valgfritt)" name="videoUrl" type="url" maxLength={2000}
        value={values.videoUrl} onChange={(event) => update("videoUrl", event.target.value)} />
      <fieldset><legend>Animasjoner</legend>
        {animations.map((scene, index) => <div key={index}>
          <AnimationPreview scene={scene} index={index} />
          <div><ActionButton type="button" variant="secondary" isDisabled={editing !== null} onPress={() => setEditing(index)}>Åpne i animasjonsbygger</ActionButton>{" "}
            <ActionButton type="button" variant="secondary" isDisabled={editing !== null} onPress={() => {
              if (window.confirm("Fjerne animasjonen fra øvelsen?")) { setAnimations((items) => items.filter((_, i) => i !== index)); setDirty(true); }
            }}>Fjern</ActionButton></div>
        </div>)}
        {animations.length < 10 && <ActionButton type="button" variant="secondary" isDisabled={editing !== null} onPress={() => setEditing(animations.length)}>Legg til animasjon</ActionButton>}
      </fieldset>
      {editing !== null && <div>
        <p>Bygg animasjonen og velg «Bruk animasjon». Husk deretter å lagre øvelsen.</p>
        <iframe key={editing} ref={frame} className="exercise-editor-frame" title={`Animasjonsbygger ${editing + 1}`}
          src={`${basePath}/ovelser/rediger/editor?mode=exercise`}
          onLoad={() => frame.current?.contentWindow?.postMessage({ type: "exercise-load-scene", scene: animations[editing] ?? null }, location.origin)} />
        <ActionButton type="button" variant="secondary" onPress={() => {
          if (window.confirm("Lukk animasjonsbyggeren uten å bruke endringene?")) setEditing(null);
        }}>Avbryt animasjonsredigering</ActionButton>
      </div>}
      {state.message && <p className={state.saved ? "notice" : "notice error"} role={state.saved ? "status" : "alert"}>{state.message}</p>}
      <SubmitButton isDisabled={editing !== null}>Lagre øvelse</SubmitButton>
      {editing !== null && <small>Velg «Bruk animasjon» i animasjonsbyggeren før du lagrer øvelsen.</small>}
      </fieldset>
    </form>
  </section>;
}
