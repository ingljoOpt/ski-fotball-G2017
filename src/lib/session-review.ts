import { z } from "zod";
import { osloToday } from "./planning.ts";

export const sessionReviewSchema = z.object({
  comment: z.string().trim().max(4000),
  exercises: z.array(z.object({
    exerciseId: z.uuid(),
    rating: z.number().int().min(0).max(5).nullable(),
    comment: z.string().trim().max(2000),
  })).max(30),
}).superRefine((review, context) => {
  if (!review.comment && !review.exercises.some((exercise) => exercise.rating !== null || exercise.comment)) {
    context.addIssue({ code: "custom", message: "Gi minst én vurdering eller skriv en kommentar." });
  }
  if (new Set(review.exercises.map((exercise) => exercise.exerciseId)).size !== review.exercises.length) {
    context.addIssue({ code: "custom", message: "En øvelse kan bare vurderes én gang per evaluering." });
  }
});

export type SessionReview = z.infer<typeof sessionReviewSchema>;

export function sessionHasEnded(event: { date: string; startTime: string; endTime: string }, now = new Date()) {
  let endDate = event.date;
  if (event.endTime < event.startTime) {
    const date = new Date(`${event.date}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    endDate = date.toISOString().slice(0, 10);
  }
  const today = osloToday(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  return today > endDate || (today === endDate && time >= event.endTime);
}