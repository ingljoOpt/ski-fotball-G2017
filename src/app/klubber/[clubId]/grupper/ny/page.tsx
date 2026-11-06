import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function NewClubGroup(props: { params: Promise<{ clubId: string }>; searchParams: SearchParams }) {
  return legacyRedirect(`/klubber/${(await props.params).clubId}/grupper/ny`, props.searchParams);
}
