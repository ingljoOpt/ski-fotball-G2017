"use client";

import { useEffect, useRef, useState } from "react";
import type { Period } from "@/lib/planning";

export function AnnualWheel({ year, months, periods, initialMonth }: {
  year: number; months: string[]; periods: Period[]; initialMonth: number;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(initialMonth - 1);
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
  return <section className="annual-wheel" aria-label={`Årshjul ${year}`}>
    <div className="wheel-chart">
      <svg viewBox="0 0 320 320" role="group" aria-label="Velg måned i årshjulet">
        {months.map((month, index) => {
          const start = index * 30 + 1;
          const end = (index + 1) * 30 - 1;
          const prefix = `${year}-${String(index + 1).padStart(2, "0")}`;
          const hasTheme = periods.some((period) => period.startDate <= `${prefix}-31` && period.endDate >= `${prefix}-01`);
          const coordinates = point(index * 30 + 15, 117).split(",");
          return <a key={month} href={`#arsmaned-${index + 1}`} aria-label={month}
            aria-current={selected === index ? "true" : undefined} onClick={(event) => {
              event.preventDefault(); showMonth(index);
            }}>
            <path className={selected === index ? "wheel-selected" : hasTheme ? "wheel-themed" : "wheel-empty"}
              d={`M${point(start, 145)} A145,145 0 0 1 ${point(end, 145)} L${point(end, 88)} A88,88 0 0 0 ${point(start, 88)} Z`} />
            <text x={coordinates[0]} y={coordinates[1]} dy=".35em" textAnchor="middle"
              className={selected === index ? "wheel-selected-label" : ""}>{month.slice(0, 3)}</text>
          </a>;
        })}
        <text x="160" y="152" textAnchor="middle" className="wheel-year">{year}</text>
        <text x="160" y="180" textAnchor="middle">{months[selected]}</text>
      </svg>
      <p className="muted">Velg en måned eller rull i årsoversikten. Fargede felt har temaperioder.</p>
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
        return <section className="wheel-month" id={`arsmaned-${index + 1}`} key={month}>
          <h2>{month} {year}</h2>
          {matching.length ? matching.map((period) => <article key={period.id}>
            <h3>{period.theme}</h3>
            <p className="preserve-lines">{period.objectives}</p>
            {period.progression && <p className="preserve-lines muted">{period.progression}</p>}
            <a href={`#periode-${period.id}`}>Rediger temaperiode →</a>
          </article>) : <p className="muted">Ingen temaer eller øvingsmål er lagt inn for denne måneden.</p>}
        </section>;
      })}
    </div>
  </section>;
}
