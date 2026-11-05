import { signIn } from "@/app/actions";
import { type SearchParams } from "@/app/components";
import { localConfig } from "@/lib/config";
import { tokenSchema } from "@/lib/validation";
import { AppLink, Card, SubmitButton } from "@/app/ui";

export const dynamic = "force-dynamic";

export default async function ConfirmLogin({ searchParams }: { searchParams: SearchParams }) {
  localConfig();
  const { token } = await searchParams;
  const parsed = tokenSchema.safeParse(token);
  return (
    <Card className="app-card narrow">
      <h1>Bekreft innlogging</h1>
      {parsed.success ? <><p>Lenken brukes først når du velger å logge inn.</p><form action={signIn}>
        <input type="hidden" name="token" value={parsed.data} />
        <SubmitButton>Logg inn</SubmitButton>
      </form></> : <p role="alert">Ugyldig innloggingslenke. <AppLink href="/logg-inn">Be om en ny lenke</AppLink>.</p>}
    </Card>
  );
}
