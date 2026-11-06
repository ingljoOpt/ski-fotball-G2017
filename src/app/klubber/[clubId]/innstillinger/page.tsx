import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function ClubSettings(props: { params: Promise<{ clubId: string }>; searchParams: SearchParams }) {
  return legacyRedirect(`/klubber/${(await props.params).clubId}/innstillinger`, props.searchParams);
}
