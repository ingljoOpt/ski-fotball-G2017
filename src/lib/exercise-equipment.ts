import { z } from "zod";

export const equipmentTypes = [
  ["balls", "Baller"], ["smallGoals", "Småmål"], ["largeCones", "Store kjegler"],
  ["markerCones", "Markeringskjegler"], ["other", "Annet"],
] as const;

const equipmentItemSchema = z.object({
  type: z.enum(["balls", "smallGoals", "largeCones", "markerCones", "other"]),
  name: z.string().trim().max(150),
  count: z.string().refine((value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0,
    "Oppgi et positivt heltall for hvert utstyr per gruppe."),
}).refine((item) => item.type !== "other" || item.name.length > 0, "Oppgi navn på annet utstyr.");

const equipmentSchema = z.object({
  legacy: z.string().max(8000),
  items: z.array(equipmentItemSchema),
}).refine(({ items }) => {
  const standardTypes = items.filter((item) => item.type !== "other").map((item) => item.type);
  return new Set(standardTypes).size === standardTypes.length;
}, "Hver standard utstyrstype kan bare legges til én gang.");

export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
const prefix = "klubbokter-utstyr-v1:";

export function readEquipment(value: string): Equipment | null {
  if (!value.startsWith(prefix)) return { legacy: value, items: [] };
  let data: unknown;
  try { data = JSON.parse(value.slice(prefix.length)); }
  catch { return null; }
  const result = equipmentSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function writeEquipment(equipment: Equipment): string {
  return equipment.items.length ? prefix + JSON.stringify(equipment) : equipment.legacy;
}
