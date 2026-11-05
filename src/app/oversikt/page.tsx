import { AppLink, Card, Chip, SubmitButton, TextInput } from "../ui";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { listClubs } from "@/lib/domain";
import { newClub } from "../actions";
import { Account, Notices, type SearchParams } from "../components";
import { ClubIdentity, ClubTheme } from "../club-theme";

export const dynamic = "force-dynamic";

export default async function Overview({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const clubs = await listClubs(await getDatabase(), user.id);
  return (
    <>
      <Account email={user.email} />
      <span className="eyebrow">Ditt trenerrom</span>
      <h1>Mine klubber</h1>
      <p className="lead">Velg en klubb for å se grupper, medlemmer og treningstider.</p>
      <Notices searchParams={searchParams} />
      <div className="columns">
        <section>
          {clubs.length ? <div className="stack">{clubs.map((club) => <ClubTheme club={club} key={club.id}><Card className="app-card">
            <ClubIdentity club={club} /><Chip>{club.isAdmin ? "Klubbadministrator" : "Gruppemedlem"}</Chip><h2>{club.name}</h2><AppLink href={`/klubber/${club.id}`}>Åpne klubben →</AppLink>
          </Card></ClubTheme>)}</div> : <Card className="app-card"><h2>Ingen klubber ennå</h2><p>Opprett din første klubb, eller åpne invitasjonen fra klubbadministrator eller hovedtrener.</p></Card>}
        </section>
        <Card className="app-card">
          <h2>Opprett klubb</h2>
          <p className="muted">Du blir klubbadministrator og kan opprette grupper og invitere hovedtrenere.</p>
          <form action={newClub}><TextInput label="Klubbnavn" name="name" isRequired minLength={2} maxLength={100} placeholder="For eksempel Ski IL Fotball" /><SubmitButton>Opprett klubb</SubmitButton></form>
        </Card>
      </div>
    </>
  );
}
