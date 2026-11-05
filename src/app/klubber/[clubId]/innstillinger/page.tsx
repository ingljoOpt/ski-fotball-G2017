import { ClubScreen } from "@/app/club-screen";
import type { SearchParams } from "@/app/components";

export default function ClubSettings(props: { params: Promise<{ clubId: string }>; searchParams: SearchParams }) {
  return <ClubScreen {...props} section="innstillinger" />;
}
