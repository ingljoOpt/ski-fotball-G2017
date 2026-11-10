import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, createClub, createGroup, DomainError, inviteCoach } from "../../src/lib/domain.ts";
import { createTrainingEvent, deleteSessionPlan, saveSessionFocus, saveSessionPlan, setTrainingCancellation, trainingEventDetails } from "../../src/lib/planning-domain.ts";
import { listSessionReviews, saveSessionReview } from "../../src/lib/session-review-domain.ts";
import { sessionAIContext } from "../../src/lib/session-ai-context.ts";
import { emptySessionPlan } from "../../src/lib/planning.ts";
import { aiEvent } from "./session-ai-fixtures.ts";
import { completePlan } from "./planning-fixtures.ts";

test("evaluations are private, version-bound, editable by their author and require a completed session", async (testContext) => {
  const directory = await mkdtemp(join(tmpdir(), "session-review-"));
  await migrateLocalDatabase(directory);
  const connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, head, coach, outsider] = await db.insert(users).values(
      ["admin", "head", "coach", "outsider"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "Testklubb");
    const { group, token } = await createGroup(db, admin.id, club.id, "Testlag", head.email, 2017);
    await acceptInvitation(db, head.id, token);
    await acceptInvitation(db, coach.id, (await inviteCoach(db, head.id, group.id, coach.email)).token);
    testContext.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-06T17:00:00Z") });
    const eventId = await createTrainingEvent(db, head.id, group.id, aiEvent);
    await saveSessionPlan(db, head.id, group.id, eventId, aiEvent, completePlan(), 1, "draft");
    const details = await trainingEventDetails(db, head.id, group.id, eventId);
    const versionId = details.versions[0].id;
    const exerciseId = details.versions[0].plan.exercises[0].id;
    const review = { comment: "", exercises: [{ exerciseId, rating: 0, comment: "Trenger mer plass" }] };
    const after = new Date("2026-11-06T18:00:00Z");
    await assert.rejects(saveSessionReview(db, head.id, group.id, eventId, versionId, 2, 0, review, new Date("2026-11-06T17:59:00Z")), /avsluttet/);
    await assert.rejects(saveSessionReview(db, outsider.id, group.id, eventId, versionId, 2, 0, review, after), DomainError);
    await assert.rejects(listSessionReviews(db, outsider.id, group.id, eventId), DomainError);
    await assert.rejects(saveSessionReview(db, head.id, group.id, eventId, versionId, 2, 0, { comment: "", exercises: [] }, after));
    await assert.rejects(saveSessionReview(db, head.id, group.id, eventId, versionId, 2, 0,
      { comment: "", exercises: [{ ...review.exercises[0], exerciseId: crypto.randomUUID() }] }, after), /ikke finnes/);
    testContext.mock.timers.setTime(after.getTime());
    await assert.rejects(saveSessionPlan(db, coach.id, group.id, eventId, { ...aiEvent, title: "Revidert plan" }, completePlan(), 2, "draft"), /Avsluttede økter/);
    await assert.rejects(saveSessionPlan(db, coach.id, group.id, eventId, { ...aiEvent, date: "2027-01-01" }, completePlan(), 2, "draft"), /Avsluttede økter/);
    await assert.rejects(saveSessionFocus(db, coach.id, group.id, eventId, 2, { theme: "Pasning", objectives: "Se opp" }), /Avsluttede økter/);
    await assert.rejects(deleteSessionPlan(db, coach.id, group.id, eventId, 2), /Avsluttede økter/);
    await assert.rejects(setTrainingCancellation(db, coach.id, group.id, eventId, 2, true), /Avsluttede økter/);
    await saveSessionReview(db, head.id, group.id, eventId, versionId, 2, 0, review, after);
    assert.equal((await listSessionReviews(db, coach.id, group.id, eventId))[0].review.exercises[0].rating, 0);
    await assert.rejects(saveSessionReview(db, head.id, group.id, eventId, versionId, 2, 0, review, after), /endret/);
    await saveSessionReview(db, head.id, group.id, eventId, versionId, 2, 1, { ...review, comment: "Generelt" }, after);
    await saveSessionReview(db, coach.id, group.id, eventId, versionId, 2, 0, { comment: "Egen vurdering", exercises: [] }, after);
    const reviews = await listSessionReviews(db, head.id, group.id, eventId);
    assert.equal(reviews.length, 2);
    assert.equal(reviews.find((item) => item.authorId === head.id)?.versionId, versionId);
    assert.equal(reviews.find((item) => item.authorId === head.id)?.review.comment, "Generelt");
    assert.equal((await trainingEventDetails(db, head.id, group.id, eventId)).versions.length, 2);
    const nextEvent = { ...aiEvent, date: "2026-11-09" };
    const nextId = await createTrainingEvent(db, coach.id, group.id, nextEvent);
    const context = await sessionAIContext(db, coach.id, group.id, nextId, 1, { event: nextEvent, plan: emptySessionPlan() },
      async () => ({ topics: [], fetchedAt: "", warnings: [] }));
    assert.equal(context.previousPlan?.evaluations.length, 2);
    const rated = context.previousPlan!.evaluations.find((item) => item.exercises.length)!;
    assert.equal(rated.planVersion, 2);
    assert.equal(rated.exercises[0].rating, 0);
    assert.equal(rated.exercises[0].title, completePlan().exercises[0].title);
    assert.equal(context.prioritySources.find((item) => item.id === "previous_evaluations")?.status, "available");
    assert.doesNotMatch(JSON.stringify(context), /@example.invalid/);
    await setTrainingCancellation(db, head.id, group.id, nextId, 1, true);
    await assert.rejects(saveSessionReview(db, head.id, group.id, nextId, versionId, 2, 0, review, new Date("2026-11-10T18:00:00Z")), /avsluttet/);
    assert.equal((await listSessionReviews(db, head.id, group.id, eventId)).length, 2);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});