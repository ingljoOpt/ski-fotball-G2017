import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function LegacyClub({ params, searchParams }: { params: Promise<{ clubId: string }>; searchParams: SearchParams }) {
  return legacyRedirect(`/klubber/${(await params).clubId}`, searchParams);
}
