import { notFound, redirect } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/domain";
import { canonicalDestination, withSearch } from "@/lib/tenant-routing";
import type { SearchParams } from "./components";

export async function legacyRedirect(path: string, searchParams: SearchParams = Promise.resolve({})) {
  const user = await requireUser();
  let destination;
  try {
    destination = await canonicalDestination(await getDatabase(), user.id, withSearch(path, await searchParams));
  } catch (error) {
    if (error instanceof DomainError || error instanceof ZodError) notFound();
    throw error;
  }
  redirect(destination);
}
