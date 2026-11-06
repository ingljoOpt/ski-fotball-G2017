import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import type { AIProposalInput, AIDraft } from "../../src/lib/session-ai.ts";
import { emptySessionPlan } from "../../src/lib/planning.ts";
import { completePlan } from "./planning-fixtures.ts";

export const aiEvent = { date: "2026-11-06", startTime: "18:00", endTime: "19:00", durationMinutes: 60,
  title: "Planøkt", theme: "Pasning", objectives: "Se før pasning" };
export function aiDraft(): AIDraft { return { event: { ...aiEvent }, plan: emptySessionPlan() }; }
export function aiProposal(): AIProposalInput {
  return { title: "Pasning og bevegelse", theme: "Pasning", objectives: "Se opp og bli spillbar", plan: completePlan() };
}
type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer T> ? T : never;
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};
function stream(parts: StreamPart[], reason: "stop" | "tool-calls"): StreamResult {
  return { stream: simulateReadableStream<StreamPart>({ chunks: [
    { type: "stream-start", warnings: [] }, ...parts,
    { type: "finish", usage, finishReason: { unified: reason, raw: reason } },
  ], chunkDelayInMs: null }) };
}
export function mockSessionModel(proposal: AIProposalInput) {
  return new MockLanguageModelV4({ doStream: [
    stream([{ type: "tool-call", toolCallId: "context-1", toolName: "readPlanningContext", input: "{}" }], "tool-calls"),
    stream([{ type: "tool-call", toolCallId: "proposal-1", toolName: "proposeSessionPlan", input: JSON.stringify(proposal) }], "tool-calls"),
    stream([{ type: "text-start", id: "text-1" }, { type: "text-delta", id: "text-1", delta: "Her er forslaget. Kontroller planen før lagring." },
      { type: "text-end", id: "text-1" }], "stop"),
  ] });
}
