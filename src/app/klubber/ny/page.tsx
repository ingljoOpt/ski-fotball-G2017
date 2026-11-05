import { requireUser } from "@/lib/auth";
import { newClub } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { AppLink, Card, SubmitButton, TextInput } from "@/app/ui";

export const dynamic = "force-dynamic";

export default async function NewClub({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  return <>
    <Account email={user.email} />
    <AppLink href="/oversikt">← Mine klubber</AppLink>
    <h1>Opprett klubb</h1>
    <Notices searchParams={searchParams} />
    <Card className="app-card settings-content">
      <p>Du blir klubbadministrator og kan opprette grupper og invitere hovedtrenere.</p>
      <form action={newClub}>
        <TextInput label="Klubbnavn" name="name" isRequired minLength={2} maxLength={100} />
        <SubmitButton>Opprett klubb</SubmitButton>
      </form>
    </Card>
  </>;
}
