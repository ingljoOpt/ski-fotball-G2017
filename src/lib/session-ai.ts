import { z } from "zod";
import { eventSchema, exerciseSchema, sessionPlanSchema, checkSessionPlan } from "./planning.ts";
import { idSchema } from "./validation.ts";

export const aiDraftSchema = z.object({ event: eventSchema, plan: sessionPlanSchema });
export type AIDraft = z.infer<typeof aiDraftSchema>;
export const aiRequestSchema = z.object({
  groupId: idSchema, eventId: idSchema, revision: z.number().int().min(1),
  draft: aiDraftSchema,
  messages: z.array(z.object({
    id: z.string().min(1).max(100),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.unknown()).min(1).max(100),
  })).min(1).max(40),
});
const aiCount = z.number().int().min(0).max(500).nullable();
const aiPlanSchema = z.object(sessionPlanSchema.shape).omit({ coachIds: true, coachIdsForExercises: true, coachAttendanceConfirmed: true,
  availableBalls: true, availableSmallGoals: true, availableLargeGoals: true, equipmentConfirmed: true, assumptions: true }).extend({
  expectedPlayers: aiCount, confirmedCoaches: aiCount,
  exercises: z.array(exerciseSchema.extend({
    simultaneousGroups: aiCount, assignedPlayers: aiCount, coaches: aiCount, balls: aiCount,
    reserveBalls: aiCount, smallGoals: aiCount, largeGoals: aiCount,
  })).max(30),
}).superRefine((value, context) => {
  if (new Set(value.exercises.map((exercise) => exercise.id)).size !== value.exercises.length) {
    context.addIssue({ code: "custom", path: ["exercises"], message: "Øvelsene må ha unike ID-er." });
  }
});
export const aiProposalInputSchema = z.object({
  title: z.string().trim().min(2).max(150), theme: z.string().trim().min(1).max(150),
  objectives: z.string().trim().min(1).max(8000), plan: aiPlanSchema,
});
export type AIProposalInput = z.infer<typeof aiProposalInputSchema>;
export type AIProposal = { draft: AIDraft; baseDraft: AIDraft; warnings: string[] };

export function chatTextMessages(input: z.infer<typeof aiRequestSchema>["messages"]) {
  let size = 0;
  const messages = input.flatMap((message) => {
    const texts = message.parts.flatMap((part) => {
      if (!z.object({ type: z.literal("text") }).safeParse(part).success) return [];
      return [z.object({ type: z.literal("text"), text: z.string().max(8000) }).parse(part).text];
    });
    const text = texts.join("\n").trim();
    size += text.length;
    return text ? [{ id: message.id, role: message.role, parts: [{ type: "text" as const, text }] }] : [];
  });
  if (size > 32_000 || messages.length === 0 || messages.at(-1)?.role !== "user") {
    throw new Error("Chatten er for lang eller mangler en ny melding. Start en ny samtale.");
  }
  return messages;
}

export function sameAIDraft(a: AIDraft, b: AIDraft) {
  const first = aiDraftSchema.safeParse(a), second = aiDraftSchema.safeParse(b);
  return first.success && second.success && JSON.stringify(first.data) === JSON.stringify(second.data);
}

export function prepareAIProposal(input: unknown, base: AIDraft, sources: {
  sourceUrl: string; sourceAge: string; sourceCheckedOn: string;
}[]): AIProposal {
  const proposal = aiProposalInputSchema.parse(input);
  const facts = ["expectedPlayers", "confirmedCoaches"] as const;
  for (const key of facts) {
    if (proposal.plan[key] !== base.plan[key]) throw new Error(`Ikke endre bekreftede rammer eller finn på antall: ${key}. Be treneren endre rammene i skjemaet.`);
  }
  for (const exercise of proposal.plan.exercises) {
    if (!exercise.sourceUrl) {
      exercise.sourceAge = "";
      exercise.sourceCheckedOn = "";
    } else {
      const source = sources.find((item) => item.sourceUrl === exercise.sourceUrl);
      if (!source) throw new Error("Bruk bare kontrollerte Tiim-kilder eller eksisterende kildelenker, eller la kildefeltene stå tomme.");
      exercise.sourceAge = source.sourceAge;
      exercise.sourceCheckedOn = source.sourceCheckedOn;
    }
  }
  const plan = sessionPlanSchema.parse({ ...proposal.plan, availableBalls: base.plan.availableBalls, availableSmallGoals: base.plan.availableSmallGoals,
    availableLargeGoals: base.plan.availableLargeGoals, equipmentConfirmed: base.plan.equipmentConfirmed, assumptions: base.plan.assumptions,
    ...(base.plan.coachIds ? { coachIds: base.plan.coachIds } : {}),
    ...(base.plan.coachIdsForExercises ? { coachIdsForExercises: base.plan.coachIdsForExercises } : {}),
    ...(base.plan.coachAttendanceConfirmed !== undefined ? { coachAttendanceConfirmed: base.plan.coachAttendanceConfirmed } : {}) });
  const checks = checkSessionPlan(plan, base.event.durationMinutes);
  if (checks.totalMinutes !== base.event.durationMinutes) throw new Error(`Øvelsene må summere til ${base.event.durationMinutes} minutter, inkludert bytter og forklaringer.`);
  if (proposal.plan.exercises.some((exercise) =>
    (exercise.coaches !== null && base.plan.confirmedCoaches !== null && exercise.coaches > base.plan.confirmedCoaches) ||
    (exercise.assignedPlayers !== null && base.plan.expectedPlayers !== null && exercise.assignedPlayers > base.plan.expectedPlayers)
  )) throw new Error("Forslaget bruker flere spillere eller trenere enn oppgitt. Regn på samlet behov for alle samtidige grupper.");
  return {
    draft: { event: { ...base.event, title: proposal.title, theme: proposal.theme, objectives: proposal.objectives }, plan },
    baseDraft: aiDraftSchema.parse(base), warnings: checks.warnings,
  };
}

export function aiConfiguration(env: Record<string, string | undefined> = process.env) {
  if (!env.AI_GATEWAY_API_KEY?.trim() && !env.VERCEL_OIDC_TOKEN?.trim()) {
    throw new Error("AI er ikke konfigurert. Sett AI_GATEWAY_API_KEY på serveren.");
  }
  const model = env.AI_MODEL?.trim() || "openai/gpt-6.1-sol";
  if (!/^[a-z0-9-]+\/[a-zA-Z0-9._:-]+$/.test(model)) throw new Error("AI_MODEL må være en gyldig provider/modell-adresse i Vercel AI Gateway.");
  return { model };
}
