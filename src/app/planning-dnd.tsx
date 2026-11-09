"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, pointerWithin,
  useDroppable, useSensor, useSensors, type CollisionDetection,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { planningThemeDrop } from "@/lib/planning";

type DragPreview = { theme: string; month: number | null; group: string | null };
const PreviewContext = createContext<DragPreview>({ theme: "", month: null, group: null });

const collisionDetection: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args);
  const hit = document.elementFromPoint(args.pointerCoordinates.x, args.pointerCoordinates.y);
  return pointerWithin(args).filter((collision) => {
    const node = args.droppableContainers.find((container) => container.id === collision.id)?.node.current;
    return node && hit && node.contains(hit);
  });
};

export function PlanningDnd({ children }: { children: ReactNode }) {
  const id = useId();
  const [preview, setPreview] = useState<DragPreview>({ theme: "", month: null, group: null });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor));
  function clear() { setPreview({ theme: "", month: null, group: null }); }
  return <DndContext id={id} sensors={sensors} collisionDetection={collisionDetection} measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    accessibility={{ screenReaderInstructions: { draggable: "Trykk mellomrom for å dra temaet. Bruk piltaster til å velge måned, mellomrom for å slippe og Escape for å avbryte." } }}
    onDragStart={({ active }) => setPreview({ theme: String(active.data.current?.theme ?? ""), month: null, group: null })}
    onDragOver={({ active, over }) => {
      const drop = planningThemeDrop(active.data.current, over?.data.current);
      setPreview({ theme: String(active.data.current?.theme ?? ""), month: drop?.month ?? null, group: over?.data.current?.group ?? null });
      if (drop) window.dispatchEvent(new CustomEvent("planning-theme-hover", { detail: drop }));
    }}
    onDragCancel={clear}
    onDragEnd={({ active, over }) => {
      const drop = planningThemeDrop(active.data.current, over?.data.current);
      clear();
      if (drop) window.dispatchEvent(new CustomEvent("planning-theme-drop", { detail: drop }));
    }}>
    <PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider>
    <DragOverlay dropAnimation={null} zIndex={80} style={{ pointerEvents: "none" }}>
      {preview.theme && <div className="planning-drag-preview"><GripVertical size={20} aria-hidden="true" /><strong>{preview.theme}</strong></div>}
    </DragOverlay>
  </DndContext>;
}

export function PlanningMonthTarget({ month, group, disabled, children }: {
  month: number; group?: string; disabled: boolean; children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `month-${month}`, data: { month, group }, disabled });
  const preview = useContext(PreviewContext);
  const replacing = !disabled && preview.theme && (preview.month === month || Boolean(group && group === preview.group));
  return <section ref={setNodeRef} className={replacing ? "wheel-month planning-drop-active" : "wheel-month"} id={`arsmaned-${month}`}>
    {replacing && <div className="planning-drop-message" role="status"><span>Slipp for å erstatte temaet med</span><strong>{preview.theme}</strong></div>}
    {children}
  </section>;
}

export function PlanningWheelTarget({ month, group, disabled, year, name, selected, onSelect, children }: {
  month: number; group?: string; disabled: boolean; year: number; name: string; selected: boolean; onSelect: () => void; children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `wheel-${month}`, data: { month, group }, disabled });
  return <a ref={setNodeRef} className={isOver ? "wheel-drop-active" : undefined}
    href={`?year=${year}&month=${month}#arsplan-maned`} aria-label={name} aria-current={selected ? "true" : undefined}
    onClick={(event) => { event.preventDefault(); onSelect(); }}>{children}</a>;
}