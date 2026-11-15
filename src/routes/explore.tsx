import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { ExploreView } from "@/components/pages";

export const Route = createFileRoute("/explore")({ component: Explore });

function Explore() {
  return (
    <Shell>
      <ExploreView />
    </Shell>
  );
}
