import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { gateway } from "ai";
import { and, eq, lte, or } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/index.ts";
import { generationJobs, groupMembers, groups, trainingTimes } from "../db/schema.ts";
import { emptySessionPlan, eventSchema, generationDate, osloToday, weekdayFor } from "./planning.ts";
import { groupCalendar, saveScheduledSessionPlan, sessionCoaches } from "./planning-domain.ts";
import { scheduledSessionAIContext } from "./session-ai-context.ts";
import { aiConfiguration, aiDraftSchema, type AIProposal } from "./session-ai.ts";
import { createSessionAgent } from "./session-agent.ts";

export function cronAuthorized(request: Request, env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production" || env.NODE_ENV !== "production" || !env.CRON_SECRET || env.CRON_SECRET.length < 16 || env.CRON_SECRET.trim() !== env.CRON_SECRET) return false;
  const expected = createHash("sha256").update(`Bearer ${env.CRON_SECRET}`).digest();
  const received = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  return timingSafeEqual(expected, received);
}

export function isOsloCronHour(now: Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", hourCycle: "h23" }).format(now) === "06";
}

type Context = Awaited<ReturnType<typeof scheduledSessionAIContext>>;
type Generator = (context: Context, signal: AbortSignal) => Promise<AIProposal>;

async function generateDraft(context: Context, signal: AbortSignal): Promise<AIProposal> {
  const result = await createSessionAgent(context, gateway(aiConfiguration().model)).generate({
    prompt: "Lag et komplett førsteutkast til denne treningen ut fra oppgitt tema, mål, årsplan og lagets rammer. Ikke finn på oppmøte eller utstyr. Treneren skal kontrollere utkastet før godkjenning.",
    abortSignal: signal,
  });
  const proposal = result.steps.flatMap((step) => step.toolResults)
    .find((result) => result.toolName === "proposeSessionPlan");
  if (!proposal || proposal.toolName !== "proposeSessionPlan") throw new Error("AI-agenten returnerte ikke et gyldig øktforslag.");
  return z.object({ draft: aiDraftSchema, baseDraft: aiDraftSchema, warnings: z.array(z.string()) }).parse(proposal.output);
}

export async function runScheduledDrafts(db: Database, now = new Date(), generate: Generator = generateDraft, deadlineMs = 550_000) {
  const startedAt = Date.now();
  const today = osloToday(now);
  const localTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 30);
  const lastDate = horizon.toISOString().slice(0, 10);
  const years = [...new Set([Number(today.slice(0, 4)), Number(lastDate.slice(0, 4))])];
  const teams = await db.select({ group: groups, userId: groupMembers.userId }).from(groups)
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.role, "head_coach")))
    .where(eq(groups.autoDraftEnabled, true));
  const candidates: { group: typeof groups.$inferSelect; userId: string; timeId: string; event: ReturnType<typeof eventSchema.parse> }[] = [];
  let failed = 0;
  for (const { group, userId } of teams) {
    if (!userId) { failed++; continue; }
    try {
      const times = await db.select().from(trainingTimes).where(and(eq(trainingTimes.groupId, group.id), eq(trainingTimes.enabled, true)));
      for (const year of years) {
        const calendar = await groupCalendar(db, userId, group.id, year);
        for (const event of calendar.entries) {
          if (!event.virtual || event.date < today || event.date > lastDate ||
            (event.date === today && event.startTime <= localTime) || generationDate(event.date, group.generationDaysBefore) > today) continue;
          const time = times.find((item) => item.startTime === event.startTime && item.endTime === event.endTime && item.weekday === weekdayFor(event.date));
          if (time) candidates.push({ group, userId, timeId: time.id, event: eventSchema.parse(event) });
        }
      }
    } catch { failed++; }
  }
  let created = 0;
  let skipped = 0;
  const deadline = Date.now() + deadlineMs;
  async function processCandidate(candidate: typeof candidates[number]) {
    const leaseToken = randomUUID();
    const claimedAt = new Date();
    const leaseUntil = new Date(claimedAt.getTime() + 240_000);
    const [job] = await db.insert(generationJobs).values({ clubId: candidate.group.clubId, groupId: candidate.group.id,
      date: candidate.event.date, startTime: candidate.event.startTime, status: "running", leaseToken, leaseUntil, updatedAt: claimedAt })
      .onConflictDoUpdate({ target: [generationJobs.groupId, generationJobs.date, generationJobs.startTime],
        set: { status: "running", leaseToken, leaseUntil, updatedAt: claimedAt },
        setWhere: or(eq(generationJobs.status, "failed"), and(eq(generationJobs.status, "running"), lte(generationJobs.leaseUntil, claimedAt))) }).returning();
    if (!job) { skipped++; return; }
    try {
      const coachIds = (await sessionCoaches(db, candidate.group.id)).map((member) => member.userId);
      const draft = { event: candidate.event, plan: { ...emptySessionPlan(), coachIds, confirmedCoaches: coachIds.length } };
      const context = await scheduledSessionAIContext(db, candidate.userId, candidate.group.id, draft);
      const proposal = await generate(context, AbortSignal.timeout(180_000));
      if (await saveScheduledSessionPlan(db, candidate.userId, candidate.group.id, candidate.timeId, job.id, leaseToken, draft, proposal,
        new Date(now.getTime() + Date.now() - startedAt))) created++;
      else skipped++;
    } catch {
      failed++;
      await db.update(generationJobs).set({ status: "failed", updatedAt: new Date() }).where(and(
        eq(generationJobs.id, job.id), eq(generationJobs.leaseToken, leaseToken), eq(generationJobs.status, "running")));
    }
  }
  let index = 0;
  while (index < candidates.length && Date.now() < deadline) {
    const batch = candidates.slice(index, index + 3);
    index += batch.length;
    await Promise.all(batch.map(processCandidate));
  }
  return { created, skipped, failed, remaining: candidates.length - index };
}