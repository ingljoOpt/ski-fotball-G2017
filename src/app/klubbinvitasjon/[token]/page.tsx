import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { tokenSchema } from "@/lib/validation";
import { joinClubAdministration } from "@/app/actions";
import { AppLink, Card, SubmitButton } from "@/app/ui";

export default async function ClubInvitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) notFound();
  const user = await currentUser();
  return <Card className="app-card narrow">
    <span className="eyebrow">Invitasjon til klubbadministrasjon</span>
    <h1>Bli klubbadministrator</h1>
    <p>Rollen gir administratortilgang til klubben og alle dens grupper. Invitasjonen må aksepteres med e-postadressen den er sendt til.</p>
    {user ? <>
      <p>Du er logget inn som <strong>{user.email}</strong>.</p>
      <form action={joinClubAdministration}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton>Aksepter administratorinvitasjon</SubmitButton>
      </form>
    </> : <AppLink className="button button--primary" href={`/logg-inn?returnPath=${encodeURIComponent(`/klubbinvitasjon/${token}`)}`}>Logg inn for å akseptere</AppLink>}
  </Card>;
}
