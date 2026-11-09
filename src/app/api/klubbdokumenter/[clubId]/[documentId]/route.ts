import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { currentUser } from "@/lib/auth";
import { getClubDocument } from "@/lib/club-documents";
import { DomainError } from "@/lib/domain";

export async function GET(_request: Request, { params }: { params: Promise<{ clubId: string; documentId: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Logg inn for å laste ned dokumentet.", { status: 401 });
  const { clubId, documentId } = await params;
  try {
    const document = await getClubDocument(await getDatabase(), user.id, clubId, documentId);
    const filename = encodeURIComponent(document.name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(Buffer.from(document.data, "base64"), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="dokument"; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) return new Response("Dokumentet finnes ikke, eller du mangler tilgang.", { status: 404 });
    throw error;
  }
}
