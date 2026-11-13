import { z } from "zod";
import board from "../../publiserte/assets/taktikk.js";
import { videoEmbedUrl } from "./video-embed.ts";
import { readEquipment } from "./exercise-equipment.ts";

export const customExerciseSchema = z.object({
  title: z.string().trim().min(1, "Oppgi navn på øvelsen.").max(150),
  description: z.string().trim().max(8000),
  theme: z.string().trim().max(150),
  themeSource: z.union([z.literal(""), z.url().max(2000)]),
  objectives: z.string().trim().max(8000),
  ageMin: z.preprocess((value) => value === "" || value === undefined ? null : value, z.coerce.number().int().min(3).max(100).nullable()),
  ageMax: z.preprocess((value) => value === "" || value === undefined ? null : value, z.coerce.number().int().min(3).max(100).nullable()),
  videoUrl: z.string().trim().max(2000).refine((value) => !value || videoEmbedUrl(value) !== null, "Bruk en gyldig YouTube- eller Vimeo-lenke."),
  equipment: z.string().trim().max(8000).refine((value) => readEquipment(value) !== null,
    "Kontroller navn og antall for utstyret per gruppe.").default(""),
  animations: z.array(z.unknown()).max(10).superRefine((animations, context) => {
    for (const [index, animation] of animations.entries()) {
      try {
        if (JSON.stringify(animation).length > 50_000) throw new Error("Animasjonen er for stor.");
        board.validateScene(animation);
      } catch {
        context.addIssue({ code: "custom", path: [index], message: "Ugyldig eller for stor animasjon." });
      }
    }
  }),
}).refine((value) => value.ageMin === null || value.ageMax === null || value.ageMax >= value.ageMin, { path: ["ageMax"], message: "Til-alder må være minst fra-alder." });

export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

export function exerciseThemeSource(theme: string, previous: { theme: string; themeSource: string } | null,
  topics: { theme: string; sourceUrl: string }[]) {
  if (previous?.theme === theme) return previous.themeSource;
  return topics.find((topic) => topic.theme.toLocaleLowerCase("nb") === theme.toLocaleLowerCase("nb"))?.sourceUrl ?? "";
}
