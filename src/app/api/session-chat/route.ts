import { createAgentUIStreamResponse, gateway } from "ai";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { currentUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { aiConfiguration, aiRequestSchema, chatTextMessages } from "@/lib/session-ai";
import { sessionAIContext } from "@/lib/session-ai-context";
import { createSessionAgent } from "@/lib/session-agent";

export const runtime = "nodejs";
export const maxDuration = 120;
const maxBodyBytes = 256 * 1024;
// shortcut: per-process throttling; use a shared rate-limit store before multi-instance production deployment.
const requests = new Map<string, { start: number; count: number }>();

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Forespørselen mangler innhold.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        throw new Error("Økt eller samtale er for stor. Forkort innholdet eller start en ny samtale.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function POST(request: Request) {
  const fail = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin) return fail("Forespørselen må komme fra appen.", 403);
  let user;
  try { user = await currentUser(); }
  catch (error) {
    console.error("AI-innlogging kunne ikke kontrolleres.", error instanceof Error ? error.name : "Ukjent feil");
    return fail("Kunne ikke kontrollere innloggingen. Prøv igjen.", 500);
  }
  if (!user) return fail("Logg inn for å bruke øktassistenten.", 401);
  let input, messages;
  try {
    input = aiRequestSchema.parse(await readBody(request));
    messages = chatTextMessages(input.messages);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return fail("Ugyldig økt eller melding. Kontroller feltene og prøv igjen.", 400);
    if (error instanceof Error) return fail(error.message, 400);
    throw error;
  }
  let context;
  try { context = await sessionAIContext(await getDatabase(), user.id, input.groupId, input.eventId, input.revision, input.draft); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) return fail("Økten finnes ikke, du mangler tilgang, eller økten er avlyst/endret. Last siden på nytt.", 409);
    console.error("AI-kontekst kunne ikke leses.", error instanceof Error ? error.name : "Ukjent feil");
    return fail("Kunne ikke lese planleggingskonteksten. Prøv igjen.", 500);
  }
  let config;
  try { config = aiConfiguration(); }
  catch (error) { return fail(error instanceof Error ? error.message : "AI er ikke konfigurert.", 503); }
  const now = Date.now();
  for (const [key, value] of requests) if (now - value.start >= 60_000) requests.delete(key);
  const rate = requests.get(user.id) ?? { start: now, count: 0 };
  if (rate.count >= 6) return fail("Du har sendt mange AI-meldinger. Vent ett minutt og prøv igjen.", 429);
  requests.set(user.id, { ...rate, count: rate.count + 1 });
  try {
    return await createAgentUIStreamResponse({
      agent: createSessionAgent(context, gateway(config.model)),
      uiMessages: messages,
      abortSignal: request.signal,
      timeout: 110_000,
      sendReasoning: false,
      headers: { "Cache-Control": "no-store" },
      onError: (error) => {
        console.error("AI-strømmen feilet.", error instanceof Error ? error.name : "Ukjent feil");
        return "AI-forespørselen feilet. Kontroller Gateway-oppsettet og prøv igjen. Ingen økt er endret.";
      },
    });
  } catch (error) {
    console.error("AI-forespørselen kunne ikke startes.", error instanceof Error ? error.name : "Ukjent feil");
    return fail("Kunne ikke starte AI. Kontroller Gateway-oppsettet og prøv igjen.", 502);
  }
}
