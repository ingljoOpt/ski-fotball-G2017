import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function GroupUsers(props: { params: Promise<{ groupId: string }>; searchParams: SearchParams }) {
  return legacyRedirect(`/grupper/${(await props.params).groupId}/brukere`, props.searchParams);
}
