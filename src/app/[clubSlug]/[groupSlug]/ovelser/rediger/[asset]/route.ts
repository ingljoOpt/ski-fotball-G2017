import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError, teamBySlug } from "@/lib/domain";
import { GET as editorAsset } from "@/app/grupper/[groupId]/ovelser/rediger/[asset]/route";

export async function GET(request: Request, { params }: {
  params: Promise<{ clubSlug: string; groupSlug: string; asset: string }>;
}) {
  const user = await requireUser();
  const { clubSlug, groupSlug, asset } = await params;
  let details;
  try { details = await teamBySlug(await getDatabase(), user.id, clubSlug, groupSlug); }
  catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  return editorAsset(request, { params: Promise.resolve({ groupId: details.group.id, asset }) });
}
