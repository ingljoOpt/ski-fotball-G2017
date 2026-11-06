import { legacyRedirect } from "@/app/legacy-redirect";
import type { SearchParams } from "@/app/components";

export default async function LegacyAnnualPlan({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: SearchParams }) {
  return legacyRedirect(`/grupper/${(await params).groupId}/arsplan`, searchParams);
}
