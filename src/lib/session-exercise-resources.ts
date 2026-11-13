import { readEquipment } from "./exercise-equipment.ts";
import type { Exercise } from "./planning.ts";

export function exerciseResourceDetails(exercise: Exercise) {
  const customEquipment = exercise.customExercise?.equipment ?? "";
  const equipment = readEquipment(customEquipment);
  const hasEquipment = [exercise.balls, exercise.reserveBalls, exercise.smallGoals, exercise.largeGoals]
    .some((value) => value !== null && value > 0) ||
    (customEquipment.trim() !== "" && (equipment === null || equipment.legacy.trim() !== "" || equipment.items.length > 0));
  const rows = exercise.noSpecialResources ? [] : ([
    ["Samtidige grupper", exercise.simultaneousGroups], ["Spillere fordelt", exercise.assignedPlayers], ["Trenere", exercise.coaches],
    ["Aktive baller", exercise.balls], ["Reserveballer", exercise.reserveBalls], ["Småmål", exercise.smallGoals], ["Store mål", exercise.largeGoals],
  ] as const).flatMap(([label, value]) => value === null ? [] : [{ label, value }]);
  return { hasEquipment, rows };
}
