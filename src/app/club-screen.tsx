import { AppLink, Card, SubmitButton, TextInput } from "@/app/ui";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { clubAdministration, DomainError, listClubGroups } from "@/lib/domain";
import { deleteClubAdmin, newAdminInvitation, newGroup, revokeAdminInvitation } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubIdentity, ClubTheme } from "@/app/club-theme";
import { ClubProfileEditor } from "@/app/club-profile-editor";
import { NavigationLinks } from "@/app/navigation";

export async function ClubScreen({ params, searchParams, section = "grupper" }: {
  params: Promise<{ clubId: string }>; searchParams: SearchParams; section?: "grupper" | "ny-gruppe" | "brukere" | "innstillinger";
}) {
  const user = await requireUser();
  const { clubId } = await params;
  let details;
  try {
    details = await listClubGroups(await getDatabase(), user.id, clubId);
  } catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  if (section !== "grupper" && !details.club.isAdmin) notFound();
  const administration = section === "brukere"
    ? await clubAdministration(await getDatabase(), user.id, clubId) : null;
  const profileKey = `${details.club.primaryColor}-${details.club.accentColor}-${createHash("sha256").update(details.club.logoData ?? "").digest("hex")}`;
  return (
    <ClubTheme club={details.club}>
      <Account email={user.email} />
      <AppLink className="back" href="/oversikt">← Mine klubber</AppLink>
      <ClubIdentity club={details.club} />
      <NavigationLinks className="context-navigation" label="Klubbmeny" items={[
        { href: `/klubber/${clubId}`, label: "Grupper" },
        ...(details.club.isAdmin ? [
          { href: `/klubber/${clubId}/brukere`, label: "Brukere" },
          { href: `/klubber/${clubId}/innstillinger`, label: "Innstillinger" },
        ] : []),
      ]} />
      <h1>{section === "grupper" ? "Grupper" : section === "ny-gruppe" ? "Opprett gruppe" : section === "brukere" ? "Brukere" : "Klubbinnstillinger"}</h1>
      <Notices searchParams={searchParams} />
      {section === "innstillinger" && <div className="settings-content" id="klubbprofil"><ClubProfileEditor key={profileKey} clubId={clubId} club={details.club} /></div>}
      {section === "grupper" && <div className="page-content">
        {details.club.isAdmin && <AppLink href={`/klubber/${clubId}/grupper/ny`}>+ Opprett gruppe</AppLink>}
        <section className="stack">
          {details.groups.length ? details.groups.map((group) => <Card className="app-card" key={group.id}>
            <h2>{group.name}</h2><AppLink href={`/grupper/${group.id}`}>Åpne gruppen →</AppLink>
          </Card>) : <Card className="app-card"><p>Ingen grupper tilgjengelig ennå.</p></Card>}
        </section>
      </div>}
      {section === "ny-gruppe" && <Card className="app-card settings-content">
          <h2>Opprett gruppe</h2>
          <p className="muted">Inviter hovedtrener som første medlem. Hovedtrener kan deretter invitere flere trenere.</p>
          <form action={newGroup}>
            <input type="hidden" name="clubId" value={clubId} />
            <TextInput label="Gruppenavn" name="name" placeholder="G2017" isRequired minLength={2} maxLength={100} />
            <TextInput label="Hovedtrenerens e-post" name="email" type="email" isRequired />
            <SubmitButton>Opprett og inviter hovedtrener</SubmitButton>
          </form>
          <small>Lokale invitasjonslenker skrives til serverterminalen.</small>
        </Card>}
      {administration && <div className="columns">
        <Card className="app-card">
          <h2>Klubbadministratorer</h2>
          <p className="muted">Administratorer kan administrere hele klubben og alle gruppene. Gruppenes trenerroller er separate.</p>
          <ul className="clean">{administration.admins.map((admin) => <li className="row" key={admin.userId}>
            <span>{admin.email}{admin.userId === user.id && <small> · deg</small>}</span>
            <form action={deleteClubAdmin}>
              <input type="hidden" name="clubId" value={clubId} />
              <input type="hidden" name="userId" value={admin.userId} />
              <SubmitButton variant="danger-soft" size="sm" isDisabled={administration.admins.length <= 1}>
                {admin.userId === user.id ? "Fratre som administrator" : "Fjern administrator"}
              </SubmitButton>
            </form>
          </li>)}</ul>
          {administration.admins.length === 1 && <p className="notice">Klubben må alltid ha minst én administrator. Inviter en ny som må akseptere før den siste kan fjernes.</p>}
        </Card>
        <Card className="app-card">
          <h2>Inviter klubbadministrator</h2>
          <form action={newAdminInvitation}>
            <input type="hidden" name="clubId" value={clubId} />
            <TextInput label="Ny administrators e-post" type="email" name="email" isRequired maxLength={254} />
            <SubmitButton>Inviter administrator</SubmitButton>
          </form>
          <small>Invitasjonen vises i serverterminalen. Tilgang gis først ved aksept med riktig e-postadresse.</small>
          {administration.pending.length > 0 && <><h3>Venter på svar</h3><ul className="clean">
            {administration.pending.map((invitation) => <li className="row" key={invitation.id}>
              <span>{invitation.email}</span>
              <form action={revokeAdminInvitation}>
                <input type="hidden" name="clubId" value={clubId} />
                <input type="hidden" name="invitationId" value={invitation.id} />
                <SubmitButton variant="danger-soft" size="sm">Tilbakekall invitasjon</SubmitButton>
              </form>
            </li>)}
          </ul></>}
        </Card>
      </div>}
    </ClubTheme>
  );
}
