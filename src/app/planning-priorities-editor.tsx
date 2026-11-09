"use client";

import { useId, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { priorityLabels, type PlanningPriority } from "@/lib/planning-priorities";
import { ActionButton } from "@/app/ui";

export function PlanningPrioritiesEditor({ priorities, disabled = false }: { priorities: PlanningPriority[]; disabled?: boolean }) {
  const id = useId();
  const [items, setItems] = useState(priorities);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <>
    <input type="hidden" name="aiPriorities" value={JSON.stringify(items)} />
    <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (!disabled && over && active.id !== over.id) setItems((current) => arrayMove(current,
        current.indexOf(active.id as PlanningPriority), current.indexOf(over.id as PlanningPriority)));
    }} accessibility={{ screenReaderInstructions: { draggable: "Trykk mellomrom for å flytte prioriteringen, bruk piltaster for å endre rekkefølgen, og mellomrom for å slippe. Escape avbryter." } }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <ol className="planning-priority-list" aria-label="Prioritert grunnlag for AI-generering">
          {items.map((id, index) => <PriorityItem key={id} id={id} rank={index + 1} disabled={disabled} />)}
        </ol>
      </SortableContext>
    </DndContext>
  </>;
}

function PriorityItem({ id, rank, disabled }: { id: PlanningPriority; rank: number; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <li ref={setNodeRef} data-priority-id={id} className={isDragging ? "planning-priority-item priority-is-dragging" : "planning-priority-item"}
    style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }}>
    <span title="Endre prioritet"><ActionButton ref={setActivatorNodeRef} {...attributes} {...listeners} className="priority-drag-handle" variant="ghost"
      aria-label={`Flytt prioritering: ${priorityLabels[id]}`} isDisabled={disabled}><GripVertical size={20} aria-hidden="true" /></ActionButton></span>
    <span className="priority-rank" aria-hidden="true">{rank}</span><span>{priorityLabels[id]}</span>
  </li>;
}