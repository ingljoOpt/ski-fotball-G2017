import { readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError, getGroupAccess } from "@/lib/domain";

const assets = {
  "site.css": "text/css",
  "taktikk-bane.css": "text/css",
  "taktikk.js": "text/javascript",
  "taktikk-rediger-modell.js": "text/javascript",
  "taktikk-rediger.js": "text/javascript",
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ groupId: string; asset: string }> }) {
  const user = await requireUser();
  const { groupId, asset } = await params;
  try { await getGroupAccess(await getDatabase(), user.id, groupId); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (asset === "editor") {
    const exerciseMode = new URL(request.url).searchParams.get("mode") === "exercise";
    const source = await readFile(path.join(process.cwd(), "publiserte", "rediger-taktikk.html"), "utf8");
    const body = source.replace(/^---[\s\S]*?---\s*/, "")
      .replace(/<a class="back-link"[\s\S]*?<\/a>/, "")
      .replace(/<details class="editor-help">[\s\S]*?<\/details>/, "")
      .replace('data-media-root="{{ \'/media/taktikk/\' | relative_url }}"', `data-media-root="/ingen-mediekilder/" data-storage-mode="${exerciseMode ? "exercise" : "file"}"`)
      .replaceAll(/\{\{ '\/assets\/([^']+)' \| relative_url \}\}/g, "./$1")
      .replace("Last ned JSON-filen og legg den i prosjektet før den kan publiseres.", exerciseMode
        ? "Lagre animasjonen i øvelsen og lagre deretter øvelsen for å beholde endringene."
        : "Last ned JSON-filen for å lagre arbeidet. Åpne filen her for å fortsette senere. Ingen automatisk lagring eller publisering.")
      .replace(/<label for="editor-filename">Filnavn<\/label>\s*<input id="editor-filename"([^>]*)>/,
        exerciseMode ? '<input id="editor-filename" type="hidden" value="taktikktavle.json">' : '<label for="editor-filename">Filnavn</label><input id="editor-filename"$1>')
      .replace("Last ned JSON</button>", exerciseMode ? "Bruk animasjon</button>" : "Last ned JSON</button>");
    return new Response(`<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Animasjonseditor</title><link rel="stylesheet" href="./site.css"></head><body>${body}</body></html>`,
      { headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "frame-ancestors 'self'", "X-Frame-Options": "SAMEORIGIN" } });
  }
  if (!Object.hasOwn(assets, asset)) notFound();
  const type = assets[asset as keyof typeof assets];
  const source = await readFile(path.join(process.cwd(), "publiserte", "assets", asset), "utf8");
  return new Response(source, { headers: { ...headers, "Content-Type": `${type}; charset=utf-8` } });
}
