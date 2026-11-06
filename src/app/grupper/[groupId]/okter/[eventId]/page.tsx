import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function LegacySession({ params, searchParams }: { params: Promise<{ groupId: string; eventId: string }>; searchParams: SearchParams }) {
  const { groupId, eventId } = await params;
  return legacyRedirect(`/grupper/${groupId}/okter/${eventId}`, searchParams);
}
