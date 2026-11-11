import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/index.ts";
import { customExercises } from "../db/schema.ts";
import { DomainError, getGroupAccess } from "./domain.ts";
import { idSchema } from "./validation.ts";
import { customExerciseSchema } from "./custom-exercises.ts";

export async function listCustomExercises(db: Database, userId: string, groupId: string) {
  await getGroupAccess(db, userId, groupId);
  return db.select().from(customExercises).where(eq(customExercises.groupId, groupId)).orderBy(customExercises.title);
}

export async function saveCustomExercise(db: Database, userId: string, groupId: string, id: string, revision: number, input: unknown) {
  const { group } = await getGroupAccess(db, userId, groupId);
  const data = customExerciseSchema.parse(input);
  if (!id) {
    const [created] = await db.insert(customExercises).values({ ...data, groupId, clubId: group.clubId }).returning();
    return created;
  }
  idSchema.parse(id);
  z.number().int().positive().parse(revision);
  const [updated] = await db.update(customExercises).set({ ...data, revision: revision + 1 }).where(and(
    eq(customExercises.id, id), eq(customExercises.groupId, groupId), eq(customExercises.revision, revision),
  )).returning();
  if (!updated) throw new DomainError("Øvelsen finnes ikke eller er endret av en annen. Kopier eventuelle endringer og åpne øvelsen på nytt.");
  return updated;
}
