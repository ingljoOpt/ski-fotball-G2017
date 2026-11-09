import { AppLink, Card, NativeInput, SubmitButton, TextInput } from "@/app/ui";
import { createHash } from "node:crypto";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { clubAdministration, DomainError, listClubGroups } from "@/lib/domain";
import { archiveDocument, deleteClubAdmin, newAdminInvitation, newGroup, revokeAdminInvitation } from "@/app/actions";
import { Account, Notices, type SearchParams } from "@/app/components";
import { ClubTheme } from "@/app/club-theme";
import { ClubProfileEditor } from "@/app/club-profile-editor";
import { NavigationLinks } from "@/app/navigation";
import { clubUrl, teamUrl } from "@/lib/slugs";
import { listClubDocuments } from "@/lib/club-documents";
import { ClubDocumentUpload } from "@/app/club-document-upload";
import { ClubMarkdownEditor } from "@/app/club-markdown-editor";
import { MarkdownView } from "@/app/markdown-view";

export async function ClubScreen({ params, searchParams, section = "grupper" }: {
  params: Promise<{ clubId: string }>; searchParams: SearchParams; section?: "grupper" | "ny-gruppe" | "brukere" | "innstillinger" | "sportsplan";
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
  if (section !== "grupper" && section !== "sportsplan" && !details.club.isAdmin) notFound();
  const basePath = clubUrl(details.club);
  const administration = section === "brukere"
    ? await clubAdministration(await getDatabase(), user.id, clubId) : null;
  const documents = section === "sportsplan"
    ? await listClubDocuments(await getDatabase(), user.id, clubId) : [];
  const profileKey = `${details.club.primaryColor}-${details.club.accentColor}-${createHash("sha256").update(details.club.logoData ?? "").digest("hex")}`;
  return (
    <ClubTheme club={details.club} header>
      <Account email={user.email} />
      <AppLink className="back" href="/oversikt">← Mine klubber</AppLink>
      <NavigationLinks className="context-navigation" label="Klubbmeny" items={[
        { href: basePath, label: "Lag" },
        { href: `${basePath}/lag/sportsplan`, label: "Sportsplan" },
        ...(details.club.isAdmin ? [
          { href: `${basePath}/brukere`, label: "Brukere" },
          { href: `${basePath}/innstillinger`, label: "Innstillinger" },
        ] : []),
      ]} />
      <h1>{section === "grupper" ? "Lag" : section === "ny-gruppe" ? "Opprett lag" : section === "brukere" ? "Brukere" : section === "sportsplan" ? "Sportsplan og retningslinjer" : "Klubbinnstillinger"}</h1>
      <Notices searchParams={searchParams} />
      {section === "innstillinger" && <div className="settings-content stack" id="klubbprofil"><p className="muted">Klubbens nettadresse: {basePath}</p><ClubProfileEditor key={profileKey} clubId={clubId} club={details.club} /></div>}
      {section === "sportsplan" && <div className="settings-content stack">
        <Card className="app-card">
          <p>Dokumentene er tilgjengelige for klubbens trenere. Teksten sendes til AI-leverandøren når øktassistenten brukes. Ikke last opp personopplysninger eller materiale klubben ikke har rett til å bruke.</p>
          {details.club.isAdmin && <>
            <details className="exercise-detail"><summary>Last opp dokumenter</summary><ClubDocumentUpload clubId={clubId} /></details>
            <details className="exercise-detail"><summary>Opprett Markdown-dokument</summary><ClubMarkdownEditor key={documents.length} clubId={clubId} /></details>
            <small>Fjernede dokumenter og tidligere versjoner arkiveres. Lagrede øktplaner endres ikke.</small>
          </>}
        </Card>
        <section className="stack" aria-label="Klubbens dokumenter">
          {documents.length ? documents.map((document) => {
            const text = document.markdownData === null ? null : Buffer.from(document.markdownData, "base64").toString("utf8");
            return <Card className="app-card" key={document.id}>
              <h2>{document.name}</h2>
              <a href={`/api/klubbdokumenter/${clubId}/${document.id}`}>Last ned {document.name}</a>
              {text !== null && <MarkdownView text={text} />}
              {text === null && <details className="exercise-detail"><summary>Les dokumenttekst</summary>
                <small>Automatisk tekstuttrekk kan mangle bilder, formatering eller annet innhold. Last ned originalen for hele dokumentet.</small>
                <p className="preserve-lines">{document.extractedText}</p>
              </details>}
              {details.club.isAdmin && <>
                {text !== null && <details className="exercise-detail"><summary>Rediger Markdown</summary>
                  <ClubMarkdownEditor clubId={clubId} document={{ id: document.id, name: document.name, text }} />
                </details>}
                <form action={archiveDocument}><input type="hidden" name="clubId" value={clubId} /><input type="hidden" name="documentId" value={document.id} />
                  <SubmitButton variant="danger-soft" size="sm">Fjern fra aktive dokumenter</SubmitButton></form>
              </>}
            </Card>;
          }) : <p className="muted">Ingen dokumenter er lagt til.</p>}
        </section>
      </div>}
      {section === "grupper" && <div className="page-content">
        {details.club.isAdmin && <AppLink href={`${basePath}/lag/ny`}>+ Opprett lag</AppLink>}
        <section className="stack">
          {details.groups.length ? details.groups.map((group) => <Card className="app-card" key={group.id}>
            <h2>{group.name}</h2><AppLink href={teamUrl(details.club, group)}>Åpne laget →</AppLink>
          </Card>) : <Card className="app-card"><p>Ingen lag tilgjengelig ennå.</p></Card>}
        </section>
      </div>}
      {section === "ny-gruppe" && <Card className="app-card settings-content">
          <h2>Opprett lag</h2>
          <p className="muted">Inviter hovedtrener som første medlem. Hovedtrener kan deretter invitere flere trenere.</p>
          <form action={newGroup}>
            <input type="hidden" name="clubId" value={clubId} />
            <TextInput label="Lagnavn" name="name" placeholder="G2017" isRequired minLength={2} maxLength={100} />
            <NativeInput label="Årgang (valgfritt)" name="birthYear" type="number" min={1900} max={2100} step={1} />
            <TextInput label="Hovedtrenerens e-post" name="email" type="email" isRequired />
            <SubmitButton>Opprett og inviter hovedtrener</SubmitButton>
          </form>
          <small>Lokale invitasjonslenker skrives til serverterminalen.</small>
        </Card>}
      {administration && <div className="columns">
        <Card className="app-card">
          <h2>Klubbadministratorer</h2>
          <p className="muted">Administratorer kan administrere hele klubben og alle lagene. Lagenes trenerroller er separate.</p>
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
