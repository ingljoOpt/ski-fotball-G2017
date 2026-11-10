"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { SessionAgentMessage } from "@/lib/session-agent";
import { aiDraftSchema, sameAIDraft, type AIDraft, type AIProposal } from "@/lib/session-ai";
import { ActionButton, TextAreaInput } from "./ui";

export function SessionAIChat({ groupId, eventId, revision, draft, saving, needsRecalculation = false, initialDraft = false, onApply }: {
  groupId: string; eventId: string; revision: number; draft: AIDraft; saving: boolean;
  initialDraft?: boolean; needsRecalculation?: boolean;
  onApply: (proposal: AIProposal) => void;
}) {
  const transport = useMemo(() => new DefaultChatTransport<SessionAgentMessage>({
    api: "/api/session-chat",
    prepareSendMessagesRequest: ({ messages, body }) => ({
      body: { ...body, messages: messages.map(({ id, role, parts }) => ({
        id, role, parts: parts.filter((part) => part.type === "text"),
      })).filter((message) => message.parts.length) },
    }),
    fetch: async (url, options) => {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("AI-tjenesten svarte ikke som forventet. Prøv igjen.");
        const parsed = z.object({ error: z.string() }).safeParse(await response.json());
        throw new Error(parsed.success ? parsed.data.error : "AI-forespørselen feilet. Prøv igjen.");
      }
      return response;
    },
  }), []);
  const { messages, sendMessage, status, error, clearError, setMessages, stop } = useChat<SessionAgentMessage>({ id: eventId, transport });
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [applyError, setApplyError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const initialRequest = useRef(false);
  const initialMessageOffset = useRef<number | null>(null);
  const busy = status === "submitted" || status === "streaming";
  const apply = useCallback((proposal: AIProposal, id: string) => {
    if (!sameAIDraft(proposal.baseDraft, draft)) {
      setApplyError("Økten er endret siden dette forslaget. Be om et nytt forslag for å unngå å overskrive endringene.");
      return;
    }
    const parsed = aiDraftSchema.safeParse(proposal.draft);
    if (!parsed.success) {
      setApplyError("Forslaget er ugyldig og kan ikke brukes. Be om et nytt forslag.");
      return;
    }
    onApply({ ...proposal, draft: parsed.data });
    setApplied((current) => [...current, id]);
    setApplyError("");
  }, [draft, onApply]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, status]);
  useEffect(() => {
    if (!initialDraft || initialRequest.current) return;
    const key = `klubbokter-initial-draft-${eventId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "started");
    } catch { /* Continue with the in-memory guard when storage is unavailable. */ }
    initialRequest.current = true;
    initialMessageOffset.current = messages.length;
    void sendMessage({ text: "Lag et komplett førsteutkast til denne økten. Ta utgangspunkt i oppgitt tema, mål, årsplan og lagets rammer. Hvis tema eller mål mangler, velg en enkel progresjon som passer alderen og forklar forutsetningene. Ikke finn på oppmøte eller utstyr. Jeg skal kontrollere og redigere forslaget før jeg lagrer." },
      { body: { groupId, eventId, revision, draft } });
  }, [initialDraft, groupId, eventId, revision, draft, messages.length, sendMessage]);
  useEffect(() => {
    const offset = initialMessageOffset.current;
    if (!initialDraft || offset === null || messages.length <= offset || busy) return;
    const proposalPart = messages.slice(offset).flatMap((message) => message.parts)
      .find((part) => part.type === "tool-proposeSessionPlan" && part.state === "output-available");
    if (proposalPart?.type === "tool-proposeSessionPlan" && proposalPart.state === "output-available") {
      apply(proposalPart.output, proposalPart.toolCallId);
    }
    initialMessageOffset.current = null;
  }, [initialDraft, messages, busy, apply]);
  return <aside className="session-ai-sidebar" aria-label="AI-øktassistent">
    <details open className="ai-chat-panel">
      <summary><h3>AI-øktassistent</h3></summary>
      <p className="muted">{initialDraft
        ? "Førsteutkastet fylles automatisk inn her. Rediger det eller be assistenten justere; ingenting lagres før du lagrer økten."
        : "Få et forslag eller juster økten. Forslag endrer ingenting før du velger å bruke dem."}</p>
      <p className="ai-privacy">Øktinnhold, årsplan, klubbens aktive dokumenttekst og inntil fem tidligere planer med evalueringer sendes via Vercel AI Gateway til modellleverandøren. Ikke skriv navn eller private opplysninger om barn. Chatten lagres ikke.</p>
      {needsRecalculation && <div className="notice" role="status">Trenerutvalget er endret siden øvelsene ble tilpasset.
        <ActionButton type="button" variant="secondary" isDisabled={busy || saving} onPress={() => {
          clearError();
          void sendMessage({ text: "Tilpass øvelsene og alle samtidige grupper til det oppdaterte antallet planlagte trenere. Behold tema og øvingsmål, og foreslå bare nødvendige endringer. Regn på samlet trenerbehov og forklar endringene." },
            { body: { groupId, eventId, revision, draft } });
        }}>Beregn øvelsene på nytt</ActionButton>
      </div>}
      <div ref={log} className="ai-messages" role="log" aria-label="Samtale med øktassistenten">
        {!messages.length && <p>For eksempel: «Lag en økt med pasning og bevegelse» eller «Tilpass organiseringen til rammene i skjemaet».</p>}
        {messages.map((message) => <article className={`ai-message ai-message-${message.role}`} key={message.id}>
          <strong>{message.role === "user" ? "Du" : "Øktassistent"}</strong>
          {message.parts.map((part, index) => {
            if (part.type === "text") return <p className="preserve-lines" key={index}>{part.text}</p>;
            if (part.type === "tool-readPlanningContext") return <p className="muted" key={index}>{part.state === "output-available" ? "Årsplan og historikk lest." : "Leser planleggingskontekst …"}</p>;
            if (part.type === "tool-readClubDocuments") return <p className="muted" key={index}>{part.state === "output-available"
              ? part.output.status === "available" ? "Klubbens dokumenter lest." : "Ingen aktive klubbdokumenter funnet."
              : part.state === "output-error" ? "Klubbens dokumenter kunne ikke leses." : "Leser klubbens dokumenter …"}</p>;
            if (part.type === "tool-findTiimExercises") {
              if (part.state === "output-error") return <p className="notice error" key={index}>Tiim-søket kunne ikke fullføres.</p>;
              if (part.state !== "output-available") return <p role="status" key={index}>Søker etter aldersriktige øvelser i Tiim …</p>;
              return <div className="muted" key={index}>
                <p>{part.output.exercises.length ? `${part.output.exercises.length} Tiim-øvelser kontrollert.` : "Ingen nye Tiim-øvelser funnet."}</p>
                {part.output.exercises.length > 0 && <details><summary>Vis øvelsene</summary><ul>
                  {part.output.exercises.map((exercise) => <li key={exercise.sourceUrl}>
                    <a href={exercise.sourceUrl}>{exercise.title}</a> ({exercise.sourceAge})<br />{exercise.relevance}
                  </li>)}
                </ul></details>}
                {part.output.warnings.map((warning, warningIndex) => <p key={warningIndex}>{warning}</p>)}
              </div>;
            }
            if (part.type === "tool-proposeSessionPlan") {
              if (part.state === "output-error") return <p className="notice error" key={index}>Forslaget bestod ikke kontrollen. Assistenten må rette det før det kan brukes.</p>;
              if (part.state !== "output-available") return <p role="status" key={index}>Lager og kontrollerer forslag …</p>;
              const proposal = part.output;
              const id = part.toolCallId;
              return <section className="ai-proposal" key={id} aria-label="Øktforslag">
                <h4>{proposal.draft.event.title}</h4>
                <p>{proposal.draft.event.theme} · {proposal.draft.event.durationMinutes} minutter</p>
                <p className="preserve-lines">{proposal.draft.event.objectives}</p>
                <ol>{proposal.draft.plan.exercises.map((exercise) => <li key={exercise.id}>{exercise.title} · {exercise.durationMinutes} min</li>)}</ol>
                {proposal.warnings.length > 0 && <details><summary>{proposal.warnings.length} kontrollpunkter</summary><ul>{proposal.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
                <ActionButton type="button" isDisabled={busy || saving || applied.includes(id)} onPress={() => apply(proposal, id)}>
                  {applied.includes(id) ? "Forslag tatt inn i skjemaet" : "Bruk forslaget i skjemaet"}
                </ActionButton>
                <small>Erstatter tittel, tema, øvingsmål og hele øvelsesplanen. Ikke lagret eller godkjent.</small>
              </section>;
            }
            return null;
          })}
        </article>)}
      </div>
      <p role="status">{busy ? status === "submitted" ? "Kontakter øktassistenten …" : "Assistenten arbeider …" : ""}</p>
      {error && <p className="notice error" role="alert">{error.message}</p>}
      {applyError && <p className="notice error" role="alert">{applyError}</p>}
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!input.trim() || busy || saving) return;
        const text = input.trim();
        clearError();
        setInput("");
        await sendMessage({ text }, { body: { groupId, eventId, revision, draft } });
      }}>
        <TextAreaInput label="Melding til øktassistenten" value={input} onChange={(event) => setInput(event.target.value)}
          rows={3} maxLength={8000} disabled={busy || saving} placeholder="Hva vil du planlegge eller endre?" />
        <div className="row">
          <ActionButton type="submit" isDisabled={!input.trim() || busy || saving}>Send melding</ActionButton>
          {busy ? <ActionButton type="button" variant="secondary" onPress={() => stop()}>Stopp</ActionButton>
            : <ActionButton type="button" variant="secondary" onPress={() => { setMessages([]); clearError(); setApplied([]); setApplyError(""); }}>Ny samtale</ActionButton>}
        </div>
      </form>
      <small>NFF-fagplan brukes sammen med trenerføringer og årsplan. Kontroller plan, utstyr og øvelseskilder selv.</small>
    </details>
  </aside>;
}
