import { z } from "zod";
import { planningPrioritiesSchema } from "./planning-priorities.ts";
import { differentiationSchema } from "./differentiation.ts";

export const nameSchema = z.string().trim().min(2, "Navnet må ha minst to tegn.").max(100, "Navnet er for langt.");
export const emailSchema = z.email("Oppgi en gyldig e-postadresse.").trim().toLowerCase().max(254);
export const idSchema = z.uuid("Ugyldig ID.");
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Ugyldig lenke.");
export const birthYearSchema = z.preprocess((value) => value === "" ? null : value,
  z.coerce.number().int().min(1900, "Årgang må være mellom 1900 og 2100.").max(2100, "Årgang må være mellom 1900 og 2100.").nullable());
export const optionalCountSchema = z.preprocess((value) => value === "" ? null : value,
  z.union([z.null(), z.coerce.number().int().min(0).max(500)]));
export const settingsSchema = z.object({
  generationDaysBefore: z.coerce.number().int().min(0).max(30),
  autoDraftEnabled: z.boolean().optional(),
  birthYear: birthYearSchema.optional(),
  playerCount: optionalCountSchema.optional(),
  coachCount: optionalCountSchema.optional(),
  differentiation: differentiationSchema.optional(),
  generalInstructions: z.string().trim().max(8000).optional(),
  aiPriorities: planningPrioritiesSchema.optional(),
});
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Oppgi klokkeslett som TT:MM.");
export function minutesBetween(startTime: string, endTime: string) {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return (minutes(endTime) - minutes(startTime) + 1440) % 1440;
}
export function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime}–${endTime}${endTime < startTime ? " (neste dag)" : ""}`;
}
export const timeRangeSchema = z.object({
  startTime: timeSchema,
  endTime: timeSchema,
}).refine(({ startTime, endTime }) => {
  const duration = minutesBetween(startTime, endTime);
  return duration >= 15 && duration <= 240;
}, { path: ["endTime"], message: "Tidsrommet må være mellom 15 og 240 minutter. Tidligere til-tid betyr neste dag." });
export const trainingTimeSchema = timeRangeSchema.safeExtend({
  weekday: z.coerce.number().int().min(1).max(7),
  expectedPlayers: optionalCountSchema.optional(),
  expectedCoaches: optionalCountSchema.optional(),
});

export function safeReturnPath(value: unknown): string {
  return typeof value === "string" && /^\/(?:invitasjon|klubbinvitasjon)\/[a-f0-9]{64}$/.test(value)
    ? value : "/oversikt";
}
