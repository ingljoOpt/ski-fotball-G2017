"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveMarkdown } from "./actions";
import { ActionButton, NativeInput, SubmitButton, TextAreaInput } from "./ui";
import { MarkdownView } from "./markdown-view";

export function ClubMarkdownEditor({ clubId, document }: {
  clubId: string; document?: { id: string; name: string; text: string };
}) {
  const [content, setContent] = useState(document?.text ?? "");
  const [name, setName] = useState("sportsplan.md");
  const [state, action] = useActionState(saveMarkdown, { message: "", saved: false });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.saved) router.refresh();
  }, [state, router]);

  function insert(before: string, after = "", example = "tekst") {
    const element = textarea.current;
    if (!element) return;
    const { selectionStart, selectionEnd } = element;
    const selected = content.slice(selectionStart, selectionEnd) || example;
    setContent(content.slice(0, selectionStart) + before + selected + after + content.slice(selectionEnd));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
    });
  }

  return <form action={action}>
    <input type="hidden" name="clubId" value={clubId} />
    <input type="hidden" name="documentId" value={document?.id ?? ""} />
    {document ? <input type="hidden" name="name" value={document.name} />
      : <NativeInput label="Filnavn" name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} />}
    <div className="markdown-toolbar" role="group" aria-label="Markdown-verktøy">
      <ActionButton type="button" variant="secondary" onPress={() => insert("## ", "", "Overskrift")}>Overskrift</ActionButton>
      <ActionButton type="button" variant="secondary" onPress={() => insert("**", "**")}>Fet</ActionButton>
      <ActionButton type="button" variant="secondary" onPress={() => insert("*", "*")}>Kursiv</ActionButton>
      <ActionButton type="button" variant="secondary" onPress={() => insert("- ", "", "Listepunkt")}>Liste</ActionButton>
      <ActionButton type="button" variant="secondary" onPress={() => insert("[", "](https://)", "Lenketekst")}>Lenke</ActionButton>
    </div>
    <TextAreaInput ref={textarea} label="Markdown-innhold" name="content" value={content}
      onChange={(event) => setContent(event.target.value)} required maxLength={50_000} rows={14} />
    <details><summary>Forhåndsvisning</summary><MarkdownView text={content} /></details>
    {state.message && <p className={state.saved ? "notice" : "notice error"} role={state.saved ? "status" : "alert"}>{state.message}</p>}
    <SubmitButton>{document ? "Lagre endringer" : "Opprett Markdown-dokument"}</SubmitButton>
    <small>Filnavnet må slutte på .md eller .markdown. Endringer lagres som en ny versjon. Bilder og HTML vises ikke i forhåndsvisningen.</small>
  </form>;
}
