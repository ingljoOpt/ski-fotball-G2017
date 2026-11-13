"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { LockOpen } from "lucide-react";
import type { Period, ThemeSuggestion } from "@/lib/planning";
import { themePeriodContent } from "@/lib/planning";
import type { CurriculumTopic } from "@/lib/nff-curriculum";
import { selectCurriculumTopic, PlanningFocusContext, SkillSuggestions } from "@/app/nff-curriculum-list";
import { PlanningMonthTarget, PlanningWheelTarget } from "@/app/planning-dnd";
import { Chip, OptionSelect, SubmitButton, TextAreaInput } from "@/app/ui";
import { saveThemePeriod } from "@/app/actions";
import { formatDate } from "@/app/planning-components";

export function SelectedMonthInput({ month }: { month: number }) {
  const search = useSearchParams();
  const selected = Number(search.get("month") ?? month);
  return <input type="hidden" name="month" value={Number.isInteger(selected) && selected >= 1 && selected <= 12 ? selected : month} />;
}

export function AnnualWheel({ year, months, periods, initialMonth, monthContent, suggestions = [], suggestionActions = {}, periodEditors = {}, curriculumTopics = [], groupId, revision = 0 }: {
  year: number; months: string[]; periods: Period[]; initialMonth: number; monthContent: ReactNode[];
  suggestions?: ThemeSuggestion[]; suggestionActions?: Record<string, ReactNode>; periodEditors?: Record<string, ReactNode>;
  curriculumTopics?: CurriculumTopic[]; groupId?: string; revision?: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(initialMonth - 1);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const proposals = suggestions.map((proposal) => {
    const topic = curriculumTopics.find((item) => item.id === assignments[proposal.id]);
    return topic ? { ...proposal, ...themePeriodContent(topic), topicId: topic.id } : proposal;
  });
  const monthPrefix = `${year}-${String(selected + 1).padStart(2, "0")}`;
  const active = periods.find((period) => period.startDate <= `${monthPrefix}-31` && period.endDate >= `${monthPrefix}-01`)
    ?? proposals.find((period) => period.startDate <= `${monthPrefix}-31` && period.endDate >= `${monthPrefix}-01`);
  const activeTopic = curriculumTopics.find((topic) => topic.kind === "main" && topic.theme === active?.theme);
  function assignTheme(topicId: string, index: number) {
    const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
    const proposal = proposals.find((item) => item.startDate <= `${prefix}-31` && item.endDate >= `${prefix}-01`);
    if (!proposal || !curriculumTopics.some((topic) => topic.id === topicId && topic.kind === "main")) return false;
    setAssignments((current) => ({ ...current, [proposal.id]: topicId }));
    return true;
  }
  function dropTheme(topicId: string, index: number) {
    showMonth(index);
    if (!assignTheme(topicId, index)) selectCurriculumTopic(topicId, index + 1);
  }
  useEffect(() => {
    function hover(event: Event) {
      const { month } = (event as CustomEvent<{ month: number }>).detail;
      showMonth(month - 1);
    }
    function drop(event: Event) {
      const { topicId, month } = (event as CustomEvent<{ topicId: string; month: number }>).detail;
      dropTheme(topicId, month - 1);
    }
    window.addEventListener("planning-theme-hover", hover);
    window.addEventListener("planning-theme-drop", drop);
    return () => { window.removeEventListener("planning-theme-hover", hover); window.removeEventListener("planning-theme-drop", drop); };
  });
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(selected + 1));
    window.history.replaceState(null, "", url);
  }, [selected, year]);
  function showMonth(index: number) {
    const container = list.current;
    const month = container?.children[index];
    if (container && month) container.scrollTo({ top: container.scrollTop + month.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop });
    setSelected(index);
  }
  useEffect(() => {
    const container = list.current;
    const month = container?.children[initialMonth - 1];
    if (container && month) container.scrollTop += month.getBoundingClientRect().top - container.getBoundingClientRect().top - container.clientTop;
  }, [initialMonth, year]);
  function point(angle: number, radius: number) {
    const radians = (angle - 90) * Math.PI / 180;
    return `${(160 + radius * Math.cos(radians)).toFixed(3)},${(160 + radius * Math.sin(radians)).toFixed(3)}`;
  }
  return <><section className="annual-wheel" aria-label={`Årshjul ${year}`}>
    <div className="wheel-chart">
      <svg viewBox="0 0 320 320" role="group" aria-label="Velg måned i årshjulet">
        {months.map((month, index) => {
          const start = index * 30 + 1;
          const end = (index + 1) * 30 - 1;
          const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
          const hasTheme = periods.some((period) => period.startDate <= `${prefix}-31` && period.endDate >= `${prefix}-01`);
          const proposal = proposals.find((period) => period.startDate <= `${prefix}-31` && period.endDate >= `${prefix}-01`);
          const coordinates = point(index * 30 + 15, 117).split(",");
          return <PlanningWheelTarget key={month} month={index + 1} group={proposal?.id} disabled={hasTheme} year={year} name={month} selected={selected === index} onSelect={() => showMonth(index)}>
            <path className={selected === index ? "wheel-selected" : hasTheme ? "wheel-themed" : "wheel-empty"}
              d={`M${point(start, 145)} A145,145 0 0 1 ${point(end, 145)} L${point(end, 88)} A88,88 0 0 0 ${point(start, 88)} Z`} />
            <text x={coordinates[0]} y={coordinates[1]} dy=".35em" textAnchor="middle"
              className={selected === index ? "wheel-selected-label" : ""}>{month.slice(0, 3)}</text>
          </PlanningWheelTarget>;
        })}
        <text x="160" y="152" textAnchor="middle" className="wheel-year">{year}</text>
        <text x="160" y="180" textAnchor="middle">{months[selected]}</text>
      </svg>
      <OptionSelect label="Vis måned" value={String(selected)} options={months.map((month, index) => ({ id: String(index), label: month }))}
        onChange={(value) => { if (typeof value === "string") showMonth(Number(value)); }} />
    </div>
    <div className="wheel-months" ref={list} tabIndex={0} role="region" aria-label="Rullbar årsoversikt"
      onScroll={() => {
        const container = list.current;
        if (!container) return;
        const index = Array.from(container.children).findIndex((child) =>
          child.getBoundingClientRect().bottom > container.getBoundingClientRect().top + 16);
        if (index >= 0) setSelected(index);
      }}>
      {months.map((month, index) => {
        const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
        const matching = periods.filter((period) => period.startDate <= `${prefix}-31` && period.endDate >= `${prefix}-01`);
        const proposal = proposals.find((period) => period.startDate <= `${prefix}-31` && period.endDate >= `${prefix}-01`);
        const topic = curriculumTopics.find((item) => item.id === proposal?.topicId);
        return <PlanningMonthTarget month={index + 1} group={proposal?.id} disabled={matching.length > 0} key={month}>
          <h2>{month} {year}</h2>
          {matching.length ? matching.map((period) => <article className="annual-locked-period" key={period.id}>
            <div className="row"><h3>{period.theme}</h3>{periodEditors[`${period.id}-${index + 1}`] ?? periodEditors[period.id] ?? <Chip>Låst</Chip>}</div>
            <small>{formatDate(period.startDate)}–{formatDate(period.endDate)}</small>
            <p className="preserve-lines">{period.objectives}</p>
            <SkillSuggestions skills={curriculumTopics.find((topic) => topic.theme === period.theme)?.skills ?? []} />
            {period.coachMoments && <div><strong>Trenernes ekstra øvingsmomenter</strong><p className="preserve-lines">{period.coachMoments}</p></div>}
            {groupId && <details className="annual-period-editor"><summary>Rediger ekstra øvingsmomenter</summary>
              <form action={saveThemePeriod}>
                <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
                <input type="hidden" name="month" value={index + 1} /><input type="hidden" name="revision" value={revision} />
                <input type="hidden" name="periodId" value={period.id} />
                {(["startDate", "endDate", "theme", "objectives", "progression", "sourceUrl"] as const).map((field) =>
                  <input key={field} type="hidden" name={field} value={period[field]} />)}
                <TextAreaInput label="Trenernes ekstra øvingsmomenter" name="coachMoments" rows={3} maxLength={8000} defaultValue={period.coachMoments ?? ""} />
                <SubmitButton>Lagre øvingsmomenter</SubmitButton>
              </form>
            </details>}
          </article>) : proposal ? <article className="annual-proposed-period">
            <div className="row"><h3>{proposal.theme}</h3><div className="row"><Chip>Forslag</Chip>
              {groupId ? <form action={saveThemePeriod}>
                <input type="hidden" name="groupId" value={groupId} /><input type="hidden" name="year" value={year} />
                <input type="hidden" name="month" value={index + 1} /><input type="hidden" name="revision" value={revision} />
                <input type="hidden" name="startDate" value={`${prefix}-01`} />
                <input type="hidden" name="endDate" value={`${prefix}-${new Date(Date.UTC(year, index + 1, 0)).getUTCDate()}`} />
                {Object.entries(proposal).filter(([name]) => !["id", "topicId", "startDate", "endDate"].includes(name)).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
                <span title="Lås tema for måneden"><SubmitButton className="planning-info-button" variant="secondary" aria-label={`Lås tema for ${month.toLocaleLowerCase("nb")}`} aria-pressed={false}><LockOpen size={18} aria-hidden="true" /></SubmitButton></span>
              </form> : suggestionActions[proposal.id]}
            </div></div>
            <small>{formatDate(proposal.startDate)}–{formatDate(proposal.endDate)}</small>
            {curriculumTopics.length > 0 && <OptionSelect label="Hovedtema for perioden" value={proposal.topicId}
              options={curriculumTopics.filter((item) => item.kind === "main").map((item) => ({ id: item.id, label: item.theme }))}
              onChange={(value) => { if (typeof value === "string") assignTheme(value, index); }} />}
            <p className="preserve-lines">{proposal.objectives}</p>
            {topic && <SkillSuggestions skills={topic.skills} />}
          </article> : <p className="muted">Ingen temaer eller øvingsmål er lagt inn for denne måneden.</p>}
        </PlanningMonthTarget>;
      })}
    </div>
  </section><section id="arsplan-maned" aria-label="Valgt måned" key={`${year}-${selected}`}>
    <PlanningFocusContext.Provider value={{ theme: active?.theme ?? "", objectives: active?.objectives ?? "", progression: active?.progression ?? "", skills: activeTopic?.skills ?? [] }}>
      {monthContent[selected]}
    </PlanningFocusContext.Provider>
  </section></>;
}
