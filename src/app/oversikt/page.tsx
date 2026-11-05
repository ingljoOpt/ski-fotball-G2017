import { AppLink, Card, Chip } from "../ui";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { listClubs } from "@/lib/domain";
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
      <div className="page-content">
        <AppLink href="/klubber/ny">+ Opprett klubb</AppLink>
        <section>
          {clubs.length ? <div className="stack">{clubs.map((club) => <ClubTheme club={club} key={club.id}><Card className="app-card">
            <ClubIdentity club={club} /><Chip>{club.isAdmin ? "Klubbadministrator" : "Gruppemedlem"}</Chip><h2>{club.name}</h2><AppLink href={`/klubber/${club.id}`}>Åpne klubben →</AppLink>
          </Card></ClubTheme>)}</div> : <Card className="app-card"><h2>Ingen klubber ennå</h2><p>Opprett din første klubb, eller åpne invitasjonen fra klubbadministrator eller hovedtrener.</p></Card>}
        </section>
      </div>
    </>
  );
}
