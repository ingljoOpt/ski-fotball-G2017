import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { cronAuthorized, isOsloCronHour, runScheduledDrafts } from "@/lib/scheduled-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(request: Request) {
  if (!cronAuthorized(request)) return Response.json({ error: "Ikke autorisert." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const now = new Date();
  if (!isOsloCronHour(now)) return Response.json({ skipped: "Utenfor klokken 06 i Oslo." }, { headers: { "Cache-Control": "no-store" } });
  if (!process.env.DATABASE_URL?.trim()) return Response.json({ error: "DATABASE_URL mangler." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const client = postgres(process.env.DATABASE_URL, { max: 4 });
  try {
    const db = drizzle(client, { schema }) as unknown as Database;
    const result = await runScheduledDrafts(db, now);
    return Response.json(result, { status: result.failed || result.remaining ? 503 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Planlagt øktgenerering feilet:", error instanceof Error ? error.name : "Ukjent feil");
    return Response.json({ error: "Planlagt øktgenerering feilet." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  } finally { await client.end({ timeout: 5 }); }
}