"use client";

import { useEffect } from "react";
import { ActionButton, Card } from "./ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <Card className="app-card narrow"><h1>Noe gikk galt</h1><p role="alert">Handlingen kunne ikke fullføres. Kontroller lokal konfigurasjon og serverloggen. Appen er foreløpig bare klar for lokal utvikling.</p><ActionButton onPress={reset}>Prøv igjen</ActionButton></Card>;
}
