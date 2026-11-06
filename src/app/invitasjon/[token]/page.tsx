import { AppLink, Card, SubmitButton } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { joinGroup } from "@/app/actions";
import { tokenSchema } from "@/lib/validation";
import { notFound } from "next/navigation";

export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) notFound();
  const user = await currentUser();
  return (
    <Card className="app-card narrow">
      <span className="eyebrow">Invitasjon til lagets trenere</span>
      <h1>Bli med på laget</h1>
      <p>Invitasjonen må aksepteres med e-postadressen den er sendt til. Tilgang til laget gis først når du bekrefter.</p>
      {user ? <><p>Du er logget inn som <strong>{user.email}</strong>.</p><form action={joinGroup}>
        <input type="hidden" name="token" value={token} /><SubmitButton>Aksepter invitasjon</SubmitButton>
      </form></> : <AppLink className="button button--primary" href={`/logg-inn?returnPath=${encodeURIComponent(`/invitasjon/${token}`)}`}>Logg inn for å akseptere</AppLink>}
    </Card>
  );
}
