import { Suspense } from "react";
import { requestLogin } from "../actions";
import { Notices, type SearchParams } from "../components";
import { localConfig } from "@/lib/config";
import { Card, SubmitButton, TextInput } from "../ui";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: SearchParams }) {
  localConfig();
  const params = await searchParams;
  return (
    <Card className="app-card narrow">
      <span className="eyebrow">Velkommen til Klubbøkter</span>
      <h1>Logg inn med e-post</h1>
      <p>Ingen passord. Vi lager en engangslenke som er gyldig i 15 minutter. Du forblir innlogget i 30 dager.</p>
      <p className="notice">Lokal utvikling: innloggingslenken skrives i terminalen der du kjører appen. Ingen e-post sendes.</p>
      <Suspense><Notices searchParams={searchParams} /></Suspense>
      {params.sendt === "1" && <p className="notice" role="status">Lenken er klar. Åpne den fra serverterminalen.</p>}
      <form action={requestLogin}>
        <input type="hidden" name="returnPath" value={typeof params.returnPath === "string" ? params.returnPath : ""} />
        <TextInput label="E-postadresse" type="email" name="email" autoComplete="email" isRequired maxLength={254} />
        <SubmitButton>Lag innloggingslenke</SubmitButton>
      </form>
    </Card>
  );
}
