"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coachSelectionChanged, sessionPlanSchema, stageLabels, type EventInput, type Exercise, type SessionPlan } from "@/lib/planning";
import type { customExercises } from "@/db/schema";
import type { CustomExerciseInput } from "@/lib/custom-exercises";
import { saveTrainingPlan } from "./actions";
import { ActionButton, NativeInput, OptionSelect } from "./ui";
import { ExerciseForm } from "./custom-exercise-bank";
import { SessionAIChat } from "./session-ai-chat";
import { SessionHeading, SessionPlanView, type EditSection } from "./session-plan-view";
import { SessionSectionEditor } from "./session-section-editor";
import { sameAIDraft } from "@/lib/session-ai";
import { sessionHasEnded } from "@/lib/session-review";
import { useRouter } from "next/navigation";
import { SessionToolbar } from "./session-toolbar";
import { X } from "lucide-react";

type SessionPlanEditorProps = {
  groupId: string; eventId: string; revision: number; initialEvent: EventInput; initialPlan: SessionPlan; coaches: { id: string; name: string }[]; ageLabel?: string; initialDraft?: boolean;
  groupName: string; statusLabel: string; versionLabel: string;
  basePath: string; ownExercises: (typeof customExercises.$inferSelect)[]; topics: { theme: string; sourceUrl: string }[];
};
type Editing = { section: EditSection } | { exerciseId: string; newExercise?: Exercise; insertAt?: number };

export function SessionPlanEditor({ groupId, eventId, revision, initialEvent, initialPlan, coaches, ageLabel, groupName, statusLabel, versionLabel, basePath, ownExercises, topics, initialDraft = false }: SessionPlanEditorProps) {
  const [event, setEvent] = useState(initialEvent);
  const [plan, setPlan] = useState(initialPlan);
  const [origin, setOrigin] = useState<"manual" | "ai">("manual");
  const [state, action, pending] = useActionState(saveTrainingPlan, null);
  const [assistantOpen, setAssistantOpen] = useState(initialDraft);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [exerciseChoice, setExerciseChoice] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseError, setExerciseError] = useState("");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const addTrigger = useRef<HTMLButtonElement>(null);
  const saveGenerated = useRef(false);
  const aiDraft = useMemo(() => ({ event, plan }), [event, plan]);
  const changed = !sameAIDraft(aiDraft, { event: initialEvent, plan: initialPlan });
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
    const refreshIfEnded = () => { if (sessionHasEnded(initialEvent)) router.refresh(); };
    const timer = window.setInterval(refreshIfEnded, 30_000);
    document.addEventListener("visibilitychange", refreshIfEnded);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refreshIfEnded); };
  }, [initialEvent, router]);
  function closeEditor() {
    dialogRef.current?.close();
    setEditing(null);
    setExerciseError("");
    if (addTrigger.current) {
      const trigger = addTrigger.current;
      addTrigger.current = null;
      requestAnimationFrame(() => {
        const fallback = [...document.querySelectorAll<HTMLButtonElement>("[data-add-section]")].find((button) => button.dataset.addSection === trigger.dataset.addSection);
        (trigger.isConnected ? trigger : fallback)?.focus();
      });
    }
  }
  function saveSection(nextEvent: EventInput, nextPlan: SessionPlan) {
    if (sameAIDraft({ event: nextEvent, plan: nextPlan }, aiDraft)) {
      closeEditor();
      return;
    }
    saveGenerated.current = !changed;
    setOrigin("manual");
    setEvent(nextEvent);
    setPlan(nextPlan);
    closeEditor();
  }
  function sectionEditor(section: EditSection) {
    return editing && "section" in editing && editing.section === section
      ? <SessionSectionEditor section={section} event={event} plan={plan} coaches={coaches} onSave={saveSection} onCancel={closeEditor} /> : null;
  }
  function exerciseEditor(id: string) {
    if (!editing || !("exerciseId" in editing) || editing.newExercise || editing.exerciseId !== id) return null;
    const exercise = plan.exercises.find((item) => item.id === id);
    if (!exercise?.customExercise) return <SessionSectionEditor exerciseId={id} event={event} plan={plan} coaches={coaches} onSave={saveSection} onCancel={closeEditor} />;
    return <>
      <ExerciseForm groupId={groupId} basePath={basePath} topics={topics} session={{
        initial: { ...exercise.customExercise, title: exercise.title, description: exercise.description, objectives: exercise.objectives },
        durationMinutes: exercise.durationMinutes,
        onSave: (content, duration) => saveExercise(exercise, content, duration),
        onCancel: closeEditor,
      }} />
      {exerciseError && <p className="notice error" role="alert">{exerciseError}</p>}
      <details className="exercise-detail"><summary>Avansert redigering og flytting</summary>
        <SessionSectionEditor exerciseId={id} event={event} plan={plan} coaches={coaches} onSave={saveSection} onCancel={closeEditor} />
      </details>
    </>;
  }
  function addExercise(stage: Exercise["stage"], insertAt: number, trigger: HTMLButtonElement) {
    const exercise: Exercise = {
      id: crypto.randomUUID(), stage, title: "", durationMinutes: 10,
      objectives: "", organization: "", description: "", coachingPoints: "", easier: "", harder: "", localAdaptations: "",
      sourceUrl: "", sourceAge: "", sourceCheckedOn: "",
      simultaneousGroups: null, assignedPlayers: plan.expectedPlayers, coaches: plan.confirmedCoaches, balls: null, reserveBalls: null, smallGoals: null, largeGoals: null,
    };
    addTrigger.current = trigger;
    setExerciseSearch("");
    setExerciseChoice(ownExercises.length ? null : "new");
    setExerciseError("");
    setEditing({ exerciseId: exercise.id, newExercise: exercise, insertAt });
  }
  function saveExercise(exercise: Exercise, content: CustomExerciseInput, durationMinutes: number, insertAt?: number) {
    const updated = { ...exercise, title: content.title, description: content.description, objectives: content.objectives,
      durationMinutes, customExercise: content };
    const exercises = insertAt === undefined ? plan.exercises.map((item) => item.id === exercise.id ? updated : item)
      : [...plan.exercises.slice(0, insertAt), updated, ...plan.exercises.slice(insertAt)];
    const parsed = sessionPlanSchema.safeParse({ ...plan, exercises });
    if (!parsed.success) {
      setExerciseError(parsed.error.issues.map((issue) => issue.message).join(" "));
      return false;
    }
    saveSection(event, parsed.data);
    return true;
  }
  function remove(exerciseId: string, label: string) {
    if (!window.confirm(`Slette ${label}?`)) return;
    saveGenerated.current = !changed;
    setOrigin("manual");
    setPlan((current) => ({ ...current, exercises: current.exercises.filter((exercise) => exercise.id !== exerciseId) }));
  }
  const canEdit = !pending && !editing;
  return <>
    <SessionToolbar onOpenAssistant={() => setAssistantOpen(true)} assistantDisabled={!canEdit} assistantOpen={assistantOpen} />
    <SessionHeading groupName={groupName} event={event} status={statusLabel} version={versionLabel}
      onEdit={canEdit ? () => setEditing({ section: "rammer" }) : undefined} editor={sectionEditor("rammer")} />
    <SessionPlanView plan={plan} coaches={coaches} durationMinutes={event.durationMinutes} theme={event.theme} objectives={event.objectives}
      ageLabel={ageLabel} onEdit={canEdit ? (exerciseId) => setEditing({ exerciseId }) : undefined} onRemove={canEdit ? remove : undefined}
      onAdd={addExercise} addDisabled={!canEdit || plan.exercises.length >= 30}
      onEditSection={canEdit ? (section) => setEditing({ section }) : undefined} sectionEditor={sectionEditor} exerciseEditor={exerciseEditor} />
    {editing && "newExercise" in editing && editing.newExercise && <dialog ref={(dialog) => {
      dialogRef.current = dialog;
      if (dialog && !dialog.open) dialog.showModal();
    }} className="training-time-dialog session-exercise-dialog session-administration" aria-labelledby="new-exercise-title"
      onCancel={(event) => {
        event.preventDefault();
        const close = dialogRef.current?.querySelector<HTMLButtonElement>("[data-close-session-exercise]");
        if (close) close.click(); else closeEditor();
      }}>
      <h2 id="new-exercise-title">Legg til øvelse</h2>
      {(editing.newExercise.stage === "theme" || editing.newExercise.stage === "game") && <OptionSelect label="Øktdel"
        value={editing.newExercise.stage} options={(["theme", "game"] as const).map((id) => ({ id, label: stageLabels[id] }))}
        onChange={(value) => {
          if (value === "theme" || value === "game") setEditing((current) => current && "newExercise" in current && current.newExercise
            ? { ...current, newExercise: { ...current.newExercise, stage: value } } : current);
        }} />}
      {exerciseChoice === null ? <>
        <div className="session-exercise-create">
          <ActionButton type="button" onPress={() => setExerciseChoice("new")}>+ Opprett ny øvelse</ActionButton>
        </div>
        <h3>Velg en lagret øvelse</h3>
        <p>Øvelsen kopieres til planen. Endringer her påvirker ikke den lagrede originalen.</p>
        <NativeInput label="Søk i egne øvelser" value={exerciseSearch} onChange={(event) => setExerciseSearch(event.target.value)} />
        <ul className="clean">{ownExercises.filter((item) => item.title.toLocaleLowerCase("nb").includes(exerciseSearch.trim().toLocaleLowerCase("nb"))).map((item) =>
          <li key={item.id}><div className="row"><strong>{item.title}</strong>
            <ActionButton type="button" variant="secondary" aria-label={`Velg ${item.title}`} onPress={() => setExerciseChoice(item.id)}>Velg</ActionButton>
          </div></li>)}</ul>
        <ActionButton type="button" variant="secondary" onPress={closeEditor}>Lukk</ActionButton>
      </> : <ExerciseForm key={exerciseChoice} groupId={groupId} basePath={basePath} topics={topics} session={{
        initial: ownExercises.find((item) => item.id === exerciseChoice), durationMinutes: editing.newExercise.durationMinutes,
        onSave: (content, duration) => saveExercise(editing.newExercise!, content, duration, editing.insertAt),
        onCancel: closeEditor,
        ...(ownExercises.length ? { onBack: () => { setExerciseChoice(null); setExerciseError(""); } } : {}),
      }} />}
      {exerciseError && <p className="notice error" role="alert">{exerciseError}</p>}
    </dialog>}
    {changed && <p className="notice" role="status">Endringene er ikke lagret. Lagre planen for å beholde dem.</p>}
    {pending && <p className="notice" role="status">Lagrer øktplanen …</p>}
    {state?.error && <p className="notice error" role="alert">{state.error} Endringene er ikke lagret.</p>}
    {changed && <div className="session-administration"><ActionButton onPress={() => formRef.current?.requestSubmit()} isDisabled={!canEdit}>Lagre endringene</ActionButton></div>}
    <form ref={formRef} action={action} hidden>
      <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="revision" value={revision} /><input type="hidden" name="plan" value={JSON.stringify(plan)} />
      <input type="hidden" name="origin" value={origin} />
      {(["date", "startTime", "endTime", "title", "theme", "objectives"] as const).map((field) => <input key={field} type="hidden" name={field} value={event[field]} />)}
    </form>
    <aside id="session-ai-drawer" className={`session-ai-drawer${assistantOpen ? " is-open" : ""}`} aria-label="AI-assistent" aria-hidden={!assistantOpen || Boolean(editing)} inert={!assistantOpen || Boolean(editing)}
      onKeyDown={(e) => { if (e.key === "Escape" && !(e.target instanceof Element && e.target.closest("dialog[open]"))) setAssistantOpen(false); }}>
      <div className="session-ai-drawer-heading"><h2>AI-assistent</h2><ActionButton variant="ghost" aria-label="Lukk AI-assistent" onPress={() => setAssistantOpen(false)}><X size={18} aria-hidden="true" /></ActionButton></div>
      <SessionAIChat groupId={groupId} eventId={eventId} revision={revision} draft={aiDraft} saving={pending || Boolean(editing)} needsRecalculation={coachSelectionChanged(plan)}
        initialDraft={initialDraft} onApply={applyAIProposal} />
    </aside>
  </>;
}
