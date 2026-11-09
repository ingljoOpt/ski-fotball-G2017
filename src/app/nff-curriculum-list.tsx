"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDraggable } from "@dnd-kit/core";
import { Popover } from "@heroui/react";
import { GripVertical, Info, RefreshCw } from "lucide-react";
import type { Curriculum, CurriculumSkill, CurriculumTopic } from "@/lib/nff-curriculum";
import { objectivesForSkill, parseSkillObjectives, selectedMomentIndices, skillForSession, skillProgression, themePeriodContent, type Period } from "@/lib/planning";
import { saveThemePeriod, updateNffCurriculum } from "@/app/actions";
import { ActionButton, AppLink, NativeInput, SubmitButton, TextAreaInput, TextInput } from "@/app/ui";
import { months } from "@/app/planning-components";

export const PlanningFocusContext = createContext<{ theme: string; objectives: string; progression?: string; skills: CurriculumSkill[] } | null>(null);

export function PlanningInfo({ title, children }: { title: string; children: ReactNode }) {
  return <Popover><span title={title}><ActionButton className="planning-info-button" variant="ghost" aria-label={`Info: ${title}`}><Info size={18} aria-hidden="true" /></ActionButton></span>
    <Popover.Content placement="bottom"><Popover.Dialog className="planning-info-dialog" aria-label={title}>
      <Popover.Heading>{title}</Popover.Heading>{children}
    </Popover.Dialog></Popover.Content>
  </Popover>;
}

export function SkillSuggestions({ skills }: { skills: CurriculumSkill[] }) {
  return <div className="skill-suggestions">{skills.map((skill) => <div className="skill-suggestion" key={skill.id}>
    <div className="row"><strong>{skill.title}</strong><PlanningInfo title={skill.title}>
      <p>{skill.relationship === "eksplisitt" ? "Kobling dokumentert av NFF." : "Faglig forslag som må vurderes av trener."}</p>
      <ul>{skill.moments.map((moment, index) => <li key={index}>{moment}</li>)}</ul>
      {skill.sourceUrl && <AppLink href={skill.sourceUrl}>NFF-kilde</AppLink>}
    </PlanningInfo></div>
  </div>)}</div>;
}
export function selectCurriculumTopic(id: string, month: number) {
  window.dispatchEvent(new CustomEvent("nff-topic-selected", { detail: { id, month } }));
}

export function NffCurriculumDrawer({ birthYear, settingsPath, ...props }: {
  birthYear: number | null; settingsPath: string; curriculum: Curriculum; groupId: string; year: number; revision: number; initialMonth: number;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const select = () => setOpen(true);
    window.addEventListener("nff-topic-selected", select);
    return () => window.removeEventListener("nff-topic-selected", select);
  }, []);
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  return <>
    <ActionButton ref={trigger} variant="secondary" aria-expanded={open} aria-controls="nff-drawer" onPress={() => setOpen(!open)}>
      <span aria-hidden="true">{open ? ">" : "<"}</span> NFF-fagplan
    </ActionButton>
    <aside ref={panel} id="nff-drawer" className="nff-drawer" aria-label="NFF-fagplanmeny" hidden={!open}>
      <div className="nff-drawer-header"><strong>NFF / Tiim</strong>
        <span title="Lukk NFF-fagplan"><ActionButton variant="secondary" aria-label="Lukk NFF-fagplan" onPress={() => { setOpen(false); trigger.current?.focus(); }}>×</ActionButton></span>
      </div>
      {birthYear === null ? <div className="notice" role="alert">
        <p>Årskull er ikke satt for laget. Sett årskull i laginnstillingene for å hente aldersriktig NFF-fagplan.</p>
        <AppLink href={settingsPath}>Åpne laginnstillinger</AppLink>
      </div> : <NffCurriculumList {...props} />}
    </aside>
  </>;
}

export function NffCurriculumList({ curriculum, groupId, year, revision, initialMonth }: {
  curriculum: Curriculum; groupId: string; year: number; revision: number; initialMonth: number;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [pending, startTransition] = useTransition();
  const [refreshError, setRefreshError] = useState("");
  const router = useRouter();
  const topics = curriculum.topics.filter((topic) => topic.kind === "main");
  return <section className="nff-curriculum stack" aria-label="NFF-fagplan">
    <div className="row"><h2>NFF-fagplan</h2>
      <span title="Oppdater fagplan"><ActionButton className="planning-info-button" variant="secondary" aria-label="Oppdater fagplan" isPending={pending} isDisabled={pending}
        onPress={() => startTransition(async () => {
          setRefreshError("");
          const form = new FormData();
          form.set("groupId", groupId); form.set("year", String(year)); form.set("month", String(month));
          try {
            const result = await updateNffCurriculum(form);
            setRefreshError(result.error);
            if (!result.error) router.refresh();
          } catch { setRefreshError("Fagplanen kunne ikke oppdateres. Sist lagrede fagplan er beholdt."); }
        })}><RefreshCw size={18} aria-hidden="true" /></ActionButton></span>
    </div>
    {curriculum.fetchedAt && <small>Hentet {new Date(curriculum.fetchedAt).toLocaleDateString("nb-NO", { timeZone: "Europe/Oslo" })}</small>}
    <AppLink href="https://tiim.no/tema/fagplaner-og-spillmodeller">Kilde: NFF / Tiim</AppLink>
    {refreshError && <p className="notice error" role="alert">{refreshError}</p>}
    <label className="app-field">Måned<select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
      {months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
    </select></label>
    <div className="nff-topic-list">
      {topics.map((topic) => <article key={topic.id} className="nff-topic-item">
        <DraggableTheme topic={topic} month={month} />
        <small>{topic.sourceTitle} · {topic.ageMin}–{topic.ageMax} år</small>
        <details><summary>Læringsmomenter for hovedtema</summary><ul>{topic.moments.map((moment, index) => <li key={index}>{moment}</li>)}</ul></details>
        {topic.skills.length > 0 && <details><summary>Delferdigheter</summary>
          {topic.skills.map((skill) => <div key={skill.id}><strong>{skill.title}</strong>
            <small>{skill.relationship === "eksplisitt" ? "Kobling dokumentert av NFF" : "Kobling foreslått av AI, må vurderes av trener"}</small>
            <ul>{skill.moments.map((moment, index) => <li key={index}>{moment}</li>)}</ul>
            <AppLink href={skill.sourceUrl ?? topic.sourceUrl}>Kilde for delferdigheten</AppLink>
          </div>)}
        </details>}
        <AppLink href={topic.sourceUrl}>Åpne fagplan</AppLink>
      </article>)}
      {!topics.length && <p className="muted">Ingen lagret fagplan for denne alderen. Oppdater fagplanen for å hente temaer.</p>}
    </div>
    <CurriculumPeriodForm topics={curriculum.topics} groupId={groupId} year={year} revision={revision} />
  </section>;
}

function DraggableTheme({ topic, month }: { topic: CurriculumTopic; month: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: topic.id, data: { topicId: topic.id, theme: topic.theme } });
  return <div ref={setNodeRef} {...attributes} {...listeners} className={isDragging ? "nff-topic-title theme-is-dragging" : "nff-topic-title"}
    aria-label={`Velg eller dra tema: ${topic.theme}`} title="Dra hovedtemaet til en periode" onClick={() => selectCurriculumTopic(topic.id, month)}>
    <GripVertical size={22} aria-hidden="true" /><strong>{topic.theme}</strong>
  </div>;
}

function CurriculumPeriodForm({ topics, groupId, year, revision }: {
  topics: CurriculumTopic[]; groupId: string; year: number; revision: number;
}) {
  const [selection, setSelection] = useState<{ topic: CurriculumTopic; month: number } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function select(event: Event) {
      const detail = (event as CustomEvent<{ id: string; month: number }>).detail;
      const topic = topics.find((item) => item.id === detail?.id);
      if (topic?.kind === "main" && Number.isInteger(detail.month) && detail.month >= 1 && detail.month <= 12) setSelection({ topic, month: detail.month });
    }
    window.addEventListener("nff-topic-selected", select);
    return () => window.removeEventListener("nff-topic-selected", select);
  }, [topics, revision]);
  useEffect(() => {
    if (selection) {
      container.current?.scrollIntoView({ behavior: "instant", block: "center" });
      container.current?.querySelector<HTMLInputElement>('input[name="startDate"]')?.focus();
    }
  }, [selection]);
  if (!selection) return null;
  const { topic, month } = selection;
  return <div ref={container} className="nff-period-form" role="region" aria-label="Ny periode fra NFF">
    <h3>Ny temaperiode · {months[month - 1]}</h3>
    <form action={saveThemePeriod} key={`${topic.id}-${month}`}>
      <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} /><input type="hidden" name="revision" value={revision} />
      <ThemePeriodFields year={year} month={month} topics={topics} initialTopicId={topic.id} />
      <div className="row"><SubmitButton>Bekreft og lås perioden</SubmitButton><ActionButton variant="secondary" onPress={() => setSelection(null)}>Avbryt</ActionButton></div>
    </form>
  </div>;
}

export function ThemePeriodFields({ year, month = 1, period, topics, initialTopicId }: {
  year: number; month?: number; period?: Period; topics: CurriculumTopic[]; initialTopicId?: string;
}) {
  const initial = topics.find((topic) => topic.kind === "main" && (initialTopicId ? topic.id === initialTopicId : topic.theme === period?.theme));
  const [topicId, setTopicId] = useState(initial?.id ?? "");
  const [theme, setTheme] = useState(period?.theme ?? initial?.theme ?? "");
  const [objectives, setObjectives] = useState(period?.objectives ?? (initial ? themePeriodContent(initial).objectives : ""));
  const [sourceUrl, setSourceUrl] = useState(period?.sourceUrl ?? initial?.sourceUrl ?? "");
  const [progression, setProgression] = useState(period?.progression ?? "");
  const [changed, setChanged] = useState(false);
  const topic = topics.find((item) => item.id === topicId);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return <>
    <div className="form-grid">
      <NativeInput label="Fra dato" name="startDate" type="date" required min={`${year}-01-01`} max={`${year}-12-31`} defaultValue={period?.startDate ?? `${prefix}-01`} />
      <NativeInput label="Til dato" name="endDate" type="date" required min={`${year}-01-01`} max={`${year}-12-31`} defaultValue={period?.endDate ?? `${prefix}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`} />
    </div>
    <label className="app-field">Hovedtema<select value={topicId} onChange={(event) => {
      const next = topics.find((item) => item.id === event.target.value);
      setTopicId(event.target.value);
      if (next) { const content = themePeriodContent(next); setTheme(content.theme); setObjectives(content.objectives); setSourceUrl(content.sourceUrl); setProgression(content.progression); setChanged(true); }
    }}><option value="">Eget hovedtema</option>{topics.filter((item) => item.kind === "main").map((item) => <option key={item.id} value={item.id}>{item.theme}</option>)}</select></label>
    {topic ? <input type="hidden" name="theme" value={theme} /> : <TextInput label="Eget hovedtema" name="theme" isRequired maxLength={150} value={theme} onChange={setTheme} />}
    <TextAreaInput label="Øvingsmål" name="objectives" required rows={4} maxLength={8000} value={objectives} onChange={(event) => setObjectives(event.target.value)} />
    {topic && <details><summary>Delferdigheter og øvingsmomenter</summary>
      {topic.skills.map((skill) => <div key={skill.id}><strong>{skill.title}</strong><ul>{skill.moments.map((moment, index) => <li key={index}>{moment}</li>)}</ul></div>)}
    </details>}
    {period && !changed || !topic ? <TextAreaInput label="Delferdigheter og progresjon" name="progression" rows={4} maxLength={8000} value={progression} onChange={(event) => setProgression(event.target.value)} />
      : <SkillProgressionFields key={topicId} skills={topic.skills} />}
    <TextInput label="Kildelenke" name="sourceUrl" type="url" maxLength={2000} value={sourceUrl} onChange={setSourceUrl} />
  </>;
}

function SkillProgressionFields({ skills }: { skills: CurriculumSkill[] }) {
  const [blocks, setBlocks] = useState<{ id: string; title: string; sessions: number }[]>(() => skills.slice(0, 3).map((skill) => ({ id: skill.id, title: skill.title, sessions: 3 })));
  const [notes, setNotes] = useState("");
  const progression = skillProgression(blocks, notes);
  return <>
    {skills.length > 0 && <fieldset className="stack"><legend>Delferdigheter i rekkefølge</legend>
      {skills.map((skill) => {
        const index = blocks.findIndex((block) => block.id === skill.id);
        return <div className="row" key={skill.id}>
          <label><input type="checkbox" checked={index >= 0} onChange={(event) => setBlocks(event.target.checked
            ? [...blocks, { id: skill.id, title: skill.title, sessions: 3 }] : blocks.filter((block) => block.id !== skill.id))} /> {index >= 0 ? `${index + 1}. ` : ""}{skill.title}</label>
          {index >= 0 && <label>Antall økter · {skill.title}<select value={blocks[index].sessions} onChange={(event) => setBlocks(blocks.map((block) => block.id === skill.id ? { ...block, sessions: Number(event.target.value) } : block))}>
            <option value={2}>2 økter</option><option value={3}>3 økter</option>
          </select></label>}
        </div>;
      })}
    </fieldset>}
    <TextAreaInput label="Trenerens progresjon og tilpasninger" rows={3} maxLength={6000} value={notes} onChange={(event) => setNotes(event.target.value)} />
    <p className="preserve-lines">{progression}</p>
    <input type="hidden" name="progression" value={progression} />
  </>;
}

export function SessionSkillFields({ theme, objectives, skills, sessionIndex = 0, locked = false }: {
  theme: string; objectives: string; skills: CurriculumSkill[]; sessionIndex?: number; locked?: boolean;
}) {
  const context = useContext(PlanningFocusContext);
  const availableSkills = skills.length ? skills : context?.skills ?? [];
  const currentTheme = theme || context?.theme || "";
  const stored = parseSkillObjectives(objectives);
  const existingName = stored?.title ?? "";
  const currentSkills = stored && !availableSkills.some((skill) => skill.title === existingName)
    ? [{ id: "stored-focus", title: existingName, moments: stored.moments }, ...availableSkills] : availableSkills;
  const [selected, setSelected] = useState("");
  const [edited, setEdited] = useState(false);
  const skill = currentSkills.find((item) => item.id === selected) ?? currentSkills.find((item) => item.title === existingName)
    ?? skillForSession(currentSkills, sessionIndex, context?.progression);
  const indices = selectedMomentIndices(skill, null, locked && !edited ? stored?.moments ?? [] : undefined);
  const baseObjectives = stored?.annualObjectives ?? (objectives || context?.objectives || "");
  const proposedObjectives = skill ? objectivesForSkill(baseObjectives, { ...skill, moments: indices.map((index) => skill.moments[index]) }) : baseObjectives;
  return <>
    {currentSkills.length > 0 && <div className="session-skill-focus">
      <div className="row"><strong>{currentTheme}</strong><small>{locked && !edited ? "Låst øktfokus" : "Forslag til øktfokus"}</small></div>
      <div className="row"><label className="app-field">Delferdighet for denne økten<select value={skill?.id ?? ""} onChange={(event) => { setSelected(event.target.value); setEdited(true); }}>
        {currentSkills.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select></label>{skill && <PlanningInfo title={skill.title}>
        <ul>{(locked && !edited && stored ? stored.moments : skill.moments).map((moment, index) => <li key={index}>{moment}</li>)}</ul>
      </PlanningInfo>}</div>
    </div>}
    <input type="hidden" name="theme" value={currentTheme} />
    <input type="hidden" name="objectives" value={locked && !edited ? objectives : proposedObjectives} />
  </>;
}