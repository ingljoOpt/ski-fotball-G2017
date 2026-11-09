import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/index.ts";
import { groups, sessionReviews, sessionVersions, trainingEvents, users } from "../db/schema.ts";
import { DomainError, getGroupAccess } from "./domain.ts";
import { idSchema } from "./validation.ts";
import { sessionHasEnded, sessionReviewSchema } from "./session-review.ts";

export async function listSessionReviews(db: Database, userId: string, groupId: string, eventId: string) {
  await getGroupAccess(db, userId, groupId);
  idSchema.parse(eventId);
  return db.select({ id: sessionReviews.id, authorId: sessionReviews.authorId, authorEmail: users.email,
    versionId: sessionReviews.versionId, review: sessionReviews.review, revision: sessionReviews.revision, updatedAt: sessionReviews.updatedAt })
    .from(sessionReviews).innerJoin(users, eq(users.id, sessionReviews.authorId))
    .where(and(eq(sessionReviews.groupId, groupId), eq(sessionReviews.eventId, eventId))).orderBy(desc(sessionReviews.updatedAt));
}

export async function saveSessionReview(db: Database, userId: string, groupId: string, eventId: string, versionId: string,
  eventRevision: unknown, reviewRevision: unknown, input: unknown, now = new Date()) {
  idSchema.parse(groupId);
  idSchema.parse(eventId);
  idSchema.parse(versionId);
  const expectedEvent = z.coerce.number().int().min(1).parse(eventRevision);
  const expectedReview = z.coerce.number().int().min(0).parse(reviewRevision);
  const review = sessionReviewSchema.parse(input);
  review.exercises = review.exercises.filter((exercise) => exercise.rating !== null || exercise.comment);
  await db.transaction(async (tx) => {
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("update");
    const { group } = await getGroupAccess(tx, userId, groupId);
    const [event] = await tx.select().from(trainingEvents).where(and(eq(trainingEvents.id, eventId), eq(trainingEvents.groupId, groupId)));
    if (!event) throw new DomainError("Økten finnes ikke for dette laget.");
    if (event.revision !== expectedEvent) throw new DomainError("Økten er endret. Last siden på nytt før du lagrer evalueringen.");
    if (event.cancelledAt || event.planDeletedAt || !sessionHasEnded(event, now)) throw new DomainError("Evaluering kan bare registreres etter at en aktiv økt er avsluttet.");
    const [existing] = await tx.select().from(sessionReviews).where(and(eq(sessionReviews.eventId, eventId), eq(sessionReviews.authorId, userId)));
    if ((existing?.revision ?? 0) !== expectedReview) throw new DomainError("Evalueringen er endret. Last siden på nytt før du lagrer.");
    if (existing && existing.versionId !== versionId) throw new DomainError("Evalueringen tilhører en annen planversjon.");
    const [version] = await tx.select().from(sessionVersions).where(and(eq(sessionVersions.eventId, eventId), eq(sessionVersions.id, versionId)));
    if (!version) throw new DomainError("Planversjonen finnes ikke for denne økten.");
    if (!existing) {
      const [latest] = await tx.select({ id: sessionVersions.id }).from(sessionVersions).where(eq(sessionVersions.eventId, eventId))
        .orderBy(desc(sessionVersions.version)).limit(1);
      if (latest?.id !== versionId) throw new DomainError("Planen er endret. Last siden på nytt før du evaluerer.");
    }
    const ids = new Set(version.plan.exercises.map((exercise) => exercise.id));
    if (review.exercises.some((exercise) => !ids.has(exercise.exerciseId))) throw new DomainError("Evalueringen inneholder en øvelse som ikke finnes i planversjonen.");
    if (existing) {
      await tx.update(sessionReviews).set({ review, revision: existing.revision + 1, updatedAt: new Date() }).where(eq(sessionReviews.id, existing.id));
    } else {
      await tx.insert(sessionReviews).values({ clubId: group.clubId, groupId, eventId, versionId, authorId: userId, review });
    }
  });
}