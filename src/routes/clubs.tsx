import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { MyClubsView } from "@/components/pages";

export const Route = createFileRoute("/clubs")({ component: Clubs });

function Clubs() {
  return (
    <Shell>
      <MyClubsView />
    </Shell>
  );
}
