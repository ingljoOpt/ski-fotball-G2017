import { z } from "zod";

export const nameSchema = z.string().trim().min(2, "Navnet må ha minst to tegn.").max(100, "Navnet er for langt.");
export const emailSchema = z.email("Oppgi en gyldig e-postadresse.").trim().toLowerCase().max(254);
export const idSchema = z.uuid("Ugyldig ID.");
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/, "Ugyldig lenke.");
export const settingsSchema = z.object({
  durationMinutes: z.coerce.number().int().min(15).max(240),
  generationDaysBefore: z.coerce.number().int().min(0).max(30),
});
export const trainingTimeSchema = z.object({
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Oppgi klokkeslett som TT:MM."),
});

export function safeReturnPath(value: unknown): string {
  return typeof value === "string" && /^\/(?:invitasjon|klubbinvitasjon)\/[a-f0-9]{64}$/.test(value)
    ? value : "/oversikt";
}
