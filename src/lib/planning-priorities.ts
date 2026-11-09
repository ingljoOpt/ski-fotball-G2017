import { z } from "zod";

export const priorityIds = ["club_guidelines", "period_focus", "coach_input", "previous_evaluations", "club_cohort_history", "tiim_exercises"] as const;
export const priorityLabels: Record<typeof priorityIds[number], string> = {
  club_guidelines: "Klubbens retningslinjer og sportsplan",
  period_focus: "Periodens tema, delferdigheter og øvingsmomenter",
  coach_input: "Trenerens innspill til manuelt opprettet økt",
  previous_evaluations: "Tidligere økter og evalueringer, særlig forrige økt",
  club_cohort_history: "Samme årskull i andre lag i klubben fra tidligere år",
  tiim_exercises: "Tiim-øvelser knyttet til tema og delferdigheter",
};
export type PlanningPriority = typeof priorityIds[number];
export const defaultPlanningPriorities: PlanningPriority[] = [...priorityIds];
export const planningPrioritiesSchema = z.array(z.enum(priorityIds)).length(priorityIds.length).refine(
  (items) => new Set(items).size === priorityIds.length, "Prioriteringene må inneholde alle punktene én gang.",
);