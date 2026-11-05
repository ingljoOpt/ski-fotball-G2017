import { ClubScreen } from "@/app/club-screen";
import type { SearchParams } from "@/app/components";

export default function NewClubGroup(props: { params: Promise<{ clubId: string }>; searchParams: SearchParams }) {
  return <ClubScreen {...props} section="ny-gruppe" />;
}
