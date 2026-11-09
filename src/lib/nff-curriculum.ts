import { gateway, type LanguageModel } from "ai";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { aiConfiguration } from "./session-ai.ts";
import { collectNffCurriculum, nffCurriculumOutputSchema, nffStartUrl, type NffCurriculumOutput } from "./nff-curriculum-agent.ts";
import initialCurriculum from "./data/nff-fagplan-8-9.json" with { type: "json" };

export const NFF_CURRICULUM_URL = nffStartUrl;
export type CurriculumSkill = { id: string; title: string; moments: string[]; sourceUrl?: string; relationship?: "eksplisitt" | "tolkning" };
export type CurriculumTopic = {
  id: string; theme: string; category: string; moments: string[];
  kind: "main" | "skill" | "support"; skills: CurriculumSkill[];
  sourceTitle: string; sourceUrl: string; ageMin: number; ageMax: number;
};
export type Curriculum = { topics: CurriculumTopic[]; fetchedAt: string; warnings: string[]; structured?: NffCurriculumOutput };

export async function crawlNffCurriculum(age: number, fetcher: typeof fetch = fetch, model?: LanguageModel): Promise<Curriculum> {
  if (!Number.isInteger(age) || age < 6 || age > 19) return { topics: [], fetchedAt: "", warnings: ["Ingen aldersriktig NFF-fagplan er valgt."] };
  const result = await collectNffCurriculum(age, model ?? gateway(aiConfiguration().model), fetcher);
  const curriculum = curriculumFromJson(result.output, result.fetchedAt, age, result.sources);
  return { ...curriculum, warnings: [...result.warnings, ...curriculum.warnings] };
}

function curriculumFromJson(input: unknown, fetchedAt: string, age: number, sources: { url: string; title: string }[] = []): Curriculum {
  const output = nffCurriculumOutputSchema.parse(input);
  if (age < output.aldersklasse.fra || age > output.aldersklasse.til) throw new Error("Fagplanen gjelder en annen aldersklasse.");
  const skills = new Map(output.delferdigheter.map((skill) => [skill.navn, skill]));
  if (skills.size !== output.delferdigheter.length || new Set(output.hovedtemaer.map((theme) => theme.navn)).size !== output.hovedtemaer.length) {
    throw new Error("Fagplanen har dupliserte navn.");
  }
  return { structured: output, fetchedAt, warnings: output.merknader,
    topics: output.hovedtemaer.map((theme, index) => ({
      id: `${theme.kildeUrl}#hovedtema-${index}`, theme: theme.navn, category: "Hovedtema", kind: "main",
      moments: theme.laeringsmomenter.map((moment) => moment.tekst),
      sourceTitle: sources.find((source) => source.url === theme.kildeUrl)?.title
        || (theme.kildeUrl === output.aldersklasse.kildeUrl ? output.aldersklasse.sitat : "NFF / Tiim"),
      sourceUrl: theme.kildeUrl, ageMin: output.aldersklasse.fra, ageMax: output.aldersklasse.til,
      skills: theme.delferdigheter.map((link) => {
        const skill = skills.get(link.navn);
        if (!skill) throw new Error("Fagplanen viser til en ukjent delferdighet.");
        return { id: `${skill.kildeUrl}#${encodeURIComponent(skill.navn)}`, title: skill.navn,
          moments: skill.laeringsmomenter.map((moment) => moment.tekst), sourceUrl: skill.kildeUrl, relationship: link.kobling };
      }),
    })) };
}

export function relevantCurriculum(curriculum: Curriculum, themes: string[]) {
  const words = themes.join(" ").toLocaleLowerCase("nb").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 3);
  const score = (topic: CurriculumTopic) => words.filter((word) => `${topic.theme} ${topic.category} ${topic.skills.map((skill) => skill.title).join(" ")}`.toLocaleLowerCase("nb").includes(word)).length;
  return { fetchedAt: curriculum.fetchedAt, warnings: curriculum.warnings, topics: [...curriculum.topics].sort((first, second) => score(second) - score(first)).slice(0, 12)
    .map((topic) => ({ ...topic, moments: topic.moments.slice(0, 8), skills: topic.skills.slice(0, 10)
      .map((skill) => ({ ...skill, moments: skill.moments.slice(0, 6) })) })) };
}

const storageDirectory = resolve(".local/nff-curriculum");
const storedSchema = z.object({ fetchedAt: z.union([z.iso.date(), z.iso.datetime()]), structured: nffCurriculumOutputSchema });
const cache = new Map<string, Promise<Curriculum>>();
const updating = new Map<string, Promise<Curriculum>>();

async function loadCurriculum(age: number, directory: string): Promise<Curriculum> {
  const candidates: Curriculum[] = [];
  if (age >= 8 && age <= 9) candidates.push(curriculumFromJson(initialCurriculum, "2026-11-08", age));
  let files: string[] = [];
  try { files = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  for (const file of files.filter((name) => /^\d{1,2}-\d{1,2}\.json$/.test(name))) {
    try {
      const bytes = await readFile(join(directory, file));
      if (bytes.length > 512_000) continue;
      const record = storedSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (age >= record.structured.aldersklasse.fra && age <= record.structured.aldersklasse.til) {
        candidates.push(curriculumFromJson(record.structured, record.fetchedAt, age));
      }
    } catch { continue; }
  }
  candidates.sort((first, second) => Date.parse(second.fetchedAt) - Date.parse(first.fetchedAt));
  return candidates[0] ?? { topics: [], fetchedAt: "", warnings: ["Ingen lagret fagplan for denne alderen. Velg Oppdater fagplan for å hente fra NFF."] };
}

export async function getNffCurriculum(age: number | null, directory = storageDirectory): Promise<Curriculum> {
  if (age === null || !Number.isInteger(age) || age < 6 || age > 19) return { topics: [], fetchedAt: "", warnings: ["Oppgi et årskull med alder 6–19 år for å hente fagplan."] };
  const key = `${directory}:${age}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const result = loadCurriculum(age, directory);
  cache.set(key, result);
  try { return await result; }
  catch (error) { cache.delete(key); throw error; }
}

export async function refreshNffCurriculum(age: number, reader = crawlNffCurriculum, directory = storageDirectory): Promise<Curriculum> {
  z.number().int().min(6).max(19).parse(age);
  const key = `${directory}:${age}`;
  const pending = updating.get(key);
  if (pending) return pending;
  const result = (async () => {
    const fresh = await reader(age);
    const record = storedSchema.parse({ fetchedAt: fresh.fetchedAt, structured: fresh.structured });
    const validated = curriculumFromJson(record.structured, record.fetchedAt, age);
    const range = record.structured.aldersklasse;
    await mkdir(directory, { recursive: true });
    const temporary = join(directory, `${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(record, null, 2), { flag: "wx" });
      await rename(temporary, join(directory, `${range.fra}-${range.til}.json`));
    } finally { await rm(temporary, { force: true }); }
    for (let memberAge = range.fra; memberAge <= range.til; memberAge++) cache.set(`${directory}:${memberAge}`, Promise.resolve(validated));
    return validated;
  })();
  updating.set(key, result);
  try { return await result; }
  finally { updating.delete(key); }
}