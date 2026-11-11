import { z } from "zod";
import board from "../../publiserte/assets/taktikk.js";
import { videoEmbedUrl } from "./video-embed.ts";

export const customExerciseSchema = z.object({
  title: z.string().trim().min(1, "Oppgi navn på øvelsen.").max(150),
  description: z.string().trim().max(8000),
  theme: z.string().trim().max(150),
  themeSource: z.union([z.literal(""), z.url().max(2000)]),
  objectives: z.string().trim().max(8000),
  ageMin: z.coerce.number().int().min(3).max(100),
  ageMax: z.coerce.number().int().min(3).max(100),
  videoUrl: z.string().trim().max(2000).refine((value) => !value || videoEmbedUrl(value) !== null, "Bruk en gyldig YouTube- eller Vimeo-lenke."),
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
}).refine((value) => value.ageMax >= value.ageMin, { path: ["ageMax"], message: "Til-alder må være minst fra-alder." });

export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;
