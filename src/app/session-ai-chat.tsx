"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { CheckCircle2, CircleAlert, LoaderCircle, RotateCcw, Sparkles, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { SessionAgentMessage } from "@/lib/session-agent";
import { aiDraftSchema, sameAIDraft, type AIDraft, type AIProposal } from "@/lib/session-ai";
import { ActionButton, TextAreaInput } from "./ui";

export function SessionAIChat({ groupId, eventId, revision, draft, saving, needsRecalculation = false, initialDraft = false, onApply }: {
  groupId: string; eventId: string; revision: number; draft: AIDraft; saving: boolean;
  initialDraft?: boolean; needsRecalculation?: boolean;
  onApply: (proposal: AIProposal, save?: boolean) => void;
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
  const [initialOpen, setInitialOpen] = useState(initialDraft);
  const [initialFailure, setInitialFailure] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const initialRequest = useRef(false);
  const initialMessageOffset = useRef<number | null>(null);
  const initialWasBusy = useRef(false);
  const busy = status === "submitted" || status === "streaming";
  const apply = useCallback((proposal: AIProposal, id: string, save = false) => {
    if (!sameAIDraft(proposal.baseDraft, draft)) {
      setApplyError("Økten er endret siden dette forslaget. Be om et nytt forslag for å unngå å overskrive endringene.");
      return false;
    }
    const parsed = aiDraftSchema.safeParse(proposal.draft);
    if (!parsed.success) {
      setApplyError("Forslaget er ugyldig og kan ikke brukes. Be om et nytt forslag.");
      return false;
    }
    onApply({ ...proposal, draft: parsed.data }, save);
    setApplied((current) => [...current, id]);
    setApplyError("");
    return true;
  }, [draft, onApply]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
    if (busy && dialog.current) dialog.current.scrollTop = dialog.current.scrollHeight;
  }, [messages, status, busy]);
  useEffect(() => {
    if (initialOpen && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [initialOpen]);
  const startInitial = useCallback(() => {
    clearError();
    setApplyError("");
    setInitialFailure("");
    initialWasBusy.current = false;
    initialMessageOffset.current = messages.length;
    void sendMessage({ text: "Lag en komplett plan for denne økten. Ta utgangspunkt i oppgitt tema, mål, årsplan og lagets rammer. Hvis tema eller mål mangler, velg en enkel progresjon som passer alderen og forklar forutsetningene. Ikke finn på oppmøte eller utstyr. Treneren skal kontrollere og redigere planen." },
      { body: { groupId, eventId, revision, draft } });
  }, [clearError, messages.length, sendMessage, groupId, eventId, revision, draft]);
  useEffect(() => {
    if (!initialDraft || initialRequest.current) return;
    const timer = window.setTimeout(() => {
      initialRequest.current = true;
      startInitial();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialDraft, startInitial]);
  useEffect(() => {
    const offset = initialMessageOffset.current;
    if (offset === null) return;
    if (busy) { initialWasBusy.current = true; return; }
    if (!initialWasBusy.current && status !== "error") return;
    const proposalPart = messages.slice(offset).flatMap((message) => message.parts)
      .find((part) => part.type === "tool-proposeSessionPlan" && part.state === "output-available");
    initialMessageOffset.current = null;
    if (status === "ready" && proposalPart?.type === "tool-proposeSessionPlan" && proposalPart.state === "output-available" && apply(proposalPart.output, proposalPart.toolCallId, true)) {
      setInitialOpen(false);
      clearInitialQuery();
    } else {
      const unfinished = messages.slice(offset).flatMap((message) => message.parts)
        .some((part) => part.type === "tool-proposeSessionPlan" && (part.state === "input-streaming" || part.state === "input-available"));
      setInitialFailure(status === "error" ? "Øktplanen kunne ikke lages." : unfinished ? "Genereringen ble avbrutt før planen var ferdig. Prøv igjen." : "Assistenten leverte ikke en gyldig øktplan.");
    }
  }, [messages, busy, status, apply]);
  function closeInitial() {
    initialMessageOffset.current = null;
    if (busy) void stop();
    setInitialOpen(false);
    clearInitialQuery();
  }
  return <aside className="session-ai-sidebar" aria-label="AI-øktassistent">
    {initialOpen && <dialog ref={dialog} className="ai-draft-dialog" aria-labelledby="ai-draft-title" onCancel={(event) => { event.preventDefault(); closeInitial(); }}>
      <header className="ai-draft-header">
        <span className="ai-draft-header-icon"><Sparkles size={19} aria-hidden="true" /></span>
        <div><h2 id="ai-draft-title">Oppretter øktplan</h2><p>AI-assistenten lager planen.</p></div>
      </header>
      <div className="ai-draft-progress" role="log" aria-label="Fremdrift for øktplan">
        {messages.filter((message) => message.role === "assistant").flatMap((message) => message.parts.map((part, index) => {
          const key = `${message.id}-${index}`;
          let text;
          if (part.type === "tool-readPlanningPriorities") text = part.state === "output-available" ? "Prioriteringer lest." : part.state === "output-error" ? "Prioriteringene kunne ikke leses." : "Leser prioriteringer …";
          else if (part.type === "tool-readPlanningContext") text = part.state === "output-available" ? "Årsplan og historikk lest." : part.state === "output-error" ? "Planleggingsgrunnlaget kunne ikke leses." : "Leser planleggingsgrunnlaget …";
          else if (part.type === "tool-readClubDocuments") text = part.state === "output-available" ? part.output.status === "available" ? "Klubbens dokumenter lest." : "Ingen aktive klubbdokumenter funnet." : part.state === "output-error" ? "Klubbens dokumenter kunne ikke leses." : "Leser klubbens dokumenter …";
          else if (part.type === "tool-findTiimExercises") text = part.state === "output-available" ? "Tiim-søket er fullført." : part.state === "output-error" ? "Tiim-søket kunne ikke fullføres." : "Søker etter aldersriktige øvelser i Tiim …";
          else if (part.type === "tool-proposeSessionPlan") text = part.state === "output-available" ? "Forslaget er kontrollert." : part.state === "output-error" ? "Forslaget bestod ikke kontrollen." : "Lager og kontrollerer forslaget …";
          else return null;
          const state = part.state === "output-available" ? "done" : part.state === "output-error" || (!busy && Boolean(initialFailure)) ? "error" : "working";
          return <div className={`ai-draft-entry ai-draft-entry-${state}`} key={key}>
            {state === "done" ? <CheckCircle2 size={16} aria-hidden="true" /> : state === "error" ? <CircleAlert size={16} aria-hidden="true" /> : <LoaderCircle className="ai-draft-spinner" size={16} aria-hidden="true" />}
            <p>{state === "error" && part.state !== "output-error" ? "Steget ble ikke fullført." : text}</p>
          </div>;
        }))}
      </div>
      <p className="ai-draft-status" role="status">{busy && <><LoaderCircle className="ai-draft-spinner" size={15} aria-hidden="true" />{status === "submitted" ? "Kontakter øktassistenten …" : "Assistenten arbeider …"}</>}</p>
      {initialFailure && <p className="notice error" role="alert">{initialFailure} {error?.message} {applyError}</p>}
      <div className="row">
        {initialFailure && <ActionButton type="button" onPress={startInitial}><RotateCcw size={15} aria-hidden="true" />Prøv igjen</ActionButton>}
        <ActionButton type="button" variant="secondary" onPress={closeInitial}>{busy && <Square size={14} aria-hidden="true" />}{busy ? "Stopp og rediger selv" : "Rediger selv"}</ActionButton>
      </div>
      <small>Kontroller planen før trening.</small>
    </dialog>}
    <details open className="ai-chat-panel">
      <summary><h3>AI-øktassistent</h3></summary>
      <p className="muted">{initialDraft
        ? "Planen lagres automatisk når den er ferdig. Kontroller den før trening."
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

function clearInitialQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete("initialDraft");
  window.history.replaceState(window.history.state, "", url);
}
