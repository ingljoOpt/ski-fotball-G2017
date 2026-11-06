import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function GroupSettings(props: { params: Promise<{ groupId: string }>; searchParams: SearchParams }) {
  return legacyRedirect(`/grupper/${(await props.params).groupId}/innstillinger`, props.searchParams);
}
