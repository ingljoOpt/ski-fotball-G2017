"use client";

import { useState } from "react";
import { uploadDocuments } from "./actions";
import { NativeInput, SubmitButton } from "./ui";

export function ClubDocumentUpload({ clubId }: { clubId: string }) {
  const [error, setError] = useState("");
  return <form action={uploadDocuments}>
    <input type="hidden" name="clubId" value={clubId} />
    <NativeInput label="Velg dokumenter" type="file" name="documents" accept=".md,.markdown,.pdf,.docx" multiple required
      aria-describedby="document-help" onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        setError(files.length > 5 ? "Velg høyst fem filer om gangen."
          : files.some((file) => !file.size || file.size > 2 * 1024 * 1024) ? "Hver fil må være mellom 1 byte og 2 MiB." : "");
      }} />
    <small id="document-help">Markdown (UTF-8), PDF med tekst eller Word (.docx). Maks 2 MiB per fil, fem om gangen og ti aktive dokumenter. Maks 50 000 tegn per dokument og 200 000 totalt.</small>
    {error && <p className="notice error" role="alert">{error}</p>}
    <SubmitButton isDisabled={Boolean(error)}>Last opp dokumenter</SubmitButton>
  </form>;
}
