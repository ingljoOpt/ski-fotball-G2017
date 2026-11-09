import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { connectLocalDatabase } from "../../src/db/local.ts";
import { clubDocuments, users } from "../../src/db/schema.ts";
import { migrateLocalDatabase } from "../../scripts/migrate.ts";
import { acceptInvitation, createClub, createGroup, DomainError } from "../../src/lib/domain.ts";
import { getClubDocument, listClubDocuments, saveClubMarkdown, uploadClubDocuments } from "../../src/lib/club-documents.ts";

test("club Markdown editing is admin-only, retains versions and rejects stale or invalid saves", async () => {
  const directory = await mkdtemp(join(tmpdir(), "club-markdown-"));
  await migrateLocalDatabase(directory);
  const connection = await connectLocalDatabase(directory);
  try {
    const { db } = connection;
    const [admin, coach, outsider] = await db.insert(users).values(
      ["markdown-admin", "markdown-coach", "markdown-outsider"].map((name) => ({ email: `${name}@example.invalid` })),
    ).returning();
    const club = await createClub(db, admin.id, "Markdown club");
    const other = await createClub(db, outsider.id, "Other club");
    const { token } = await createGroup(db, admin.id, club.id, "Lag", coach.email);
    await acceptInvitation(db, coach.id, token);
    await assert.rejects(saveClubMarkdown(db, coach.id, club.id, "", "plan.md", "# Nei"), DomainError);
    await assert.rejects(saveClubMarkdown(db, admin.id, other.id, "", "plan.md", "# Nei"), DomainError);
    await assert.rejects(saveClubMarkdown(db, admin.id, club.id, "", "plan.pdf", "Feil format"), DomainError);
    await saveClubMarkdown(db, admin.id, club.id, "", "plan.md", "\n# Første plan\n\n");
    const original = (await listClubDocuments(db, coach.id, club.id))[0];
    assert.equal(Buffer.from(original.markdownData!, "base64").toString("utf8"), "\n# Første plan\n\n");
    await assert.rejects(saveClubMarkdown(db, coach.id, club.id, original.id, original.name, "# Nei"), DomainError);
    await assert.rejects(saveClubMarkdown(db, outsider.id, club.id, original.id, original.name, "# Nei"), DomainError);
    await assert.rejects(saveClubMarkdown(db, admin.id, club.id, original.id, original.name, "x".repeat(50_001)), /50 000/);
    assert.equal((await getClubDocument(db, coach.id, club.id, original.id)).extractedText, "# Første plan");
    await saveClubMarkdown(db, admin.id, club.id, original.id, "ignoreres.md", "# Oppdatert plan");
    const updated = (await listClubDocuments(db, coach.id, club.id))[0];
    assert.notEqual(updated.id, original.id);
    assert.equal(updated.name, original.name);
    assert.equal((await getClubDocument(db, coach.id, club.id, updated.id)).extractedText, "# Oppdatert plan");
    await assert.rejects(saveClubMarkdown(db, admin.id, club.id, original.id, original.name, "# Gammel endring"), /endret eller fjernet/);
    const versions = await db.select().from(clubDocuments).where(eq(clubDocuments.clubId, club.id));
    assert.equal(versions.length, 2);
    assert.ok(versions.find((item) => item.id === original.id)?.archivedAt);
    assert.equal(versions.find((item) => item.id === updated.id)?.archivedAt, null);
    await uploadClubDocuments(db, admin.id, club.id, [new File(["tekst"], "veiledning.md")]);
    const [pdf] = await db.insert(clubDocuments).values({ clubId: club.id, name: "plan.pdf", mediaType: "application/pdf",
      data: Buffer.from("eksempel").toString("base64"), extractedText: "PDF-tekst", createdBy: admin.id }).returning();
    await assert.rejects(saveClubMarkdown(db, admin.id, club.id, pdf.id, "plan.md", "# Feil"), /Bare Markdown/);
    assert.equal((await getClubDocument(db, coach.id, club.id, pdf.id)).extractedText, "PDF-tekst");
    await assert.rejects(getClubDocument(db, outsider.id, club.id, updated.id), DomainError);
  } finally {
    await connection.close();
    await rm(directory, { recursive: true });
  }
});
