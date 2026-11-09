import { and, eq, isNull, sql } from "drizzle-orm";
import { fromBuffer } from "yauzl";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import type { Database } from "../db/index.ts";
import { clubDocuments, clubs } from "../db/schema.ts";
import { DomainError, listClubGroups, requireClubAdmin } from "./domain.ts";
import { idSchema } from "./validation.ts";

const maxFileBytes = 2 * 1024 * 1024;
const maxDocuments = 10;
const maxText = 200_000;

async function validateWordArchive(data: Buffer) {
  await new Promise<void>((resolve, reject) => {
    fromBuffer(data, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error ?? new Error("Ugyldig Word-fil"));
      let total = 0;
      let count = 0;
      let documentFound = false;
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        count++;
        total += entry.uncompressedSize;
        if (count > 1000 || total > 20 * 1024 * 1024 || entry.uncompressedSize > 10 * 1024 * 1024 || entry.isEncrypted()) {
          zip.close();
          reject(new Error("Word-filen er for stor eller kryptert"));
          return;
        }
        if (entry.fileName === "word/document.xml") documentFound = true;
        if (entry.fileName.endsWith("/")) return zip.readEntry();
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            zip.close();
            reject(streamError ?? new Error("Word-innholdet kunne ikke leses"));
            return;
          }
          let bytes = 0;
          stream.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > entry.uncompressedSize || bytes > 10 * 1024 * 1024) {
              stream.destroy(new Error("Word-innholdet er for stort"));
            }
          });
          stream.on("error", (readError) => { zip.close(); reject(readError); });
          stream.on("end", () => zip.readEntry());
        });
      });
      zip.on("end", () => documentFound ? resolve() : reject(new Error("Word-dokument mangler")));
      zip.readEntry();
    });
  });
}

export async function readClubDocument(file: File) {
  const name = file.name.normalize("NFC");
  if (!name || name.length > 200 || /[\/\\\x00-\x1f\x7f]/.test(name)) throw new DomainError("Ugyldig filnavn.");
  if (!file.size || file.size > maxFileBytes) throw new DomainError(`${name}: filen må være mellom 1 byte og 2 MiB.`);
  const extension = name.toLowerCase().split(".").pop();
  if (!["md", "markdown", "pdf", "docx"].includes(extension ?? "")) throw new DomainError(`${name}: bare Markdown (.md eller .markdown), PDF og Word (.docx) støttes.`);
  const data = Buffer.from(await file.arrayBuffer());
  let text: string;
  let mediaType: string;
  try {
    if (extension === "md" || extension === "markdown") {
      text = new TextDecoder("utf-8", { fatal: true }).decode(data);
      if (text.includes("\0")) throw new Error("Ugyldig tekst");
      mediaType = "text/markdown";
    } else if (extension === "pdf") {
      if (!data.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Ugyldig PDF");
      const parser = new PDFParse({ data: new Uint8Array(data) });
      try {
        const info = await parser.getInfo();
        if (info.total > 100) throw new Error("For mange sider");
        text = (await parser.getText()).pages.map((page) => page.text).join("\n");
      } finally { await parser.destroy(); }
      mediaType = "application/pdf";
    } else {
      await validateWordArchive(data);
      text = (await mammoth.extractRawText({ buffer: data })).value;
      mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
  } catch (error) {
    console.error("Dokumentet kunne ikke leses:", error instanceof Error ? error.name : "Ukjent feil");
    throw new DomainError(`${name}: filen kunne ikke leses. Kontroller formatet og at den ikke er passordbeskyttet.`);
  }
  text = text.trim();
  if (!text) throw new DomainError(`${name}: ingen tekst kunne hentes ut. Skannede PDF-er må tekstgjenkjennes før opplasting.`);
  if (text.length > 50_000) throw new DomainError(`${name}: dokumentteksten kan ikke være lengre enn 50 000 tegn.`);
  return { name, mediaType, data: data.toString("base64"), extractedText: text };
}

export async function listClubDocuments(db: Database, userId: string, clubId: string) {
  await listClubGroups(db, userId, clubId);
  return db.select({ id: clubDocuments.id, name: clubDocuments.name, mediaType: clubDocuments.mediaType, createdAt: clubDocuments.createdAt,
    extractedText: clubDocuments.extractedText,
    markdownData: sql<string | null>`case when ${clubDocuments.mediaType} = 'text/markdown' then ${clubDocuments.data} else null end` })
    .from(clubDocuments).where(and(eq(clubDocuments.clubId, clubId), isNull(clubDocuments.archivedAt)))
    .orderBy(clubDocuments.createdAt);
}

export async function saveClubMarkdown(db: Database, userId: string, clubId: string, documentId: string, name: string, content: string) {
  await requireClubAdmin(db, userId, clubId);
  if (documentId) idSchema.parse(documentId);
  await db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    const active = await tx.select().from(clubDocuments)
      .where(and(eq(clubDocuments.clubId, clubId), isNull(clubDocuments.archivedAt)));
    const previous = documentId ? active.find((item) => item.id === documentId) : undefined;
    if (documentId && !previous) throw new DomainError("Dokumentet er endret eller fjernet av en annen administrator. Kopier teksten din og last siden på nytt.");
    if (previous && previous.mediaType !== "text/markdown") throw new DomainError("Bare Markdown-dokumenter kan redigeres her.");
    if (!/\.(?:md|markdown)$/i.test(previous?.name ?? name)) throw new DomainError("Filnavnet må slutte på .md eller .markdown.");
    const document = await readClubDocument(new File([content], previous?.name ?? name));
    if (document.mediaType !== "text/markdown") throw new DomainError("Filnavnet må slutte på .md eller .markdown.");
    const remaining = active.filter((item) => item.id !== documentId);
    if (remaining.length + 1 > maxDocuments) throw new DomainError("Klubben kan ha maksimalt 10 aktive dokumenter.");
    if (remaining.reduce((sum, item) => sum + item.extractedText.length, document.extractedText.length) > maxText)
      throw new DomainError("Dokumentene kan til sammen inneholde maksimalt 200 000 tegn.");
    if (previous) await tx.update(clubDocuments).set({ archivedAt: new Date() }).where(eq(clubDocuments.id, previous.id));
    await tx.insert(clubDocuments).values({ ...document, clubId, createdBy: userId });
  });
}

export async function uploadClubDocuments(db: Database, userId: string, clubId: string, files: File[]) {
  await requireClubAdmin(db, userId, clubId);
  if (!files.length || files.length > 5) throw new DomainError("Velg mellom én og fem filer om gangen.");
  const documents: Awaited<ReturnType<typeof readClubDocument>>[] = [];
  for (const file of files) documents.push(await readClubDocument(file));
  await db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    const active = await tx.select({ text: clubDocuments.extractedText }).from(clubDocuments)
      .where(and(eq(clubDocuments.clubId, clubId), isNull(clubDocuments.archivedAt)));
    if (active.length + documents.length > maxDocuments) throw new DomainError("Klubben kan ha maksimalt 10 aktive dokumenter.");
    if ([...active.map((item) => item.text), ...documents.map((item) => item.extractedText)].reduce((sum, text) => sum + text.length, 0) > maxText)
      throw new DomainError("Dokumentene kan til sammen inneholde maksimalt 200 000 tegn.");
    await tx.insert(clubDocuments).values(documents.map((document) => ({ ...document, clubId, createdBy: userId })));
  });
}

export async function archiveClubDocument(db: Database, userId: string, clubId: string, documentId: string) {
  idSchema.parse(documentId);
  await db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    const [updated] = await tx.update(clubDocuments).set({ archivedAt: new Date() }).where(and(
      eq(clubDocuments.id, documentId), eq(clubDocuments.clubId, clubId), isNull(clubDocuments.archivedAt),
    )).returning({ id: clubDocuments.id });
    if (!updated) throw new DomainError("Dokumentet finnes ikke eller er allerede fjernet.");
  });
}

export async function getClubDocument(db: Database, userId: string, clubId: string, documentId: string) {
  idSchema.parse(documentId);
  await listClubGroups(db, userId, clubId);
  const [document] = await db.select().from(clubDocuments).where(and(
    eq(clubDocuments.id, documentId), eq(clubDocuments.clubId, clubId), isNull(clubDocuments.archivedAt),
  ));
  if (!document) throw new DomainError("Dokumentet finnes ikke.");
  return document;
}
