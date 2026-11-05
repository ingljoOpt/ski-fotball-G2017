import { GroupScreen } from "@/app/group-screen";
import type { SearchParams } from "@/app/components";

export default function GroupUsers(props: { params: Promise<{ groupId: string }>; searchParams: SearchParams }) {
  return <GroupScreen {...props} section="brukere" />;
}
