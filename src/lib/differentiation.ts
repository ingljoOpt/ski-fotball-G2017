import { z } from "zod";

const levelSchema = z.object({
  players: z.number().int().min(0).max(500),
  groups: z.number().int().min(0).max(500),
});

export const differentiationSchema = z.object({
  enabled: z.boolean(),
  levels: z.tuple([levelSchema, levelSchema, levelSchema]),
}).superRefine(({ enabled, levels }, context) => {
  if (enabled && levels.reduce((total, level) => total + level.players, 0) > 500) {
    context.addIssue({ code: "custom", path: ["levels"], message: "Totalt antall spillere kan ikke overstige 500." });
  }
});

export type Differentiation = z.infer<typeof differentiationSchema>;
export const defaultDifferentiation: Differentiation = {
  enabled: false, levels: [{ players: 0, groups: 0 }, { players: 0, groups: 0 }, { players: 0, groups: 0 }],
};

export function differentiationCounts(points: number[], total: number) {
  const first = Math.min(points[0], total);
  const second = Math.max(first, Math.min(points[1], total));
  return [first, second - first, total - second];
}

