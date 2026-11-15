import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { RewardsView } from "@/components/pages";

export const Route = createFileRoute("/rewards")({ component: Rewards });

function Rewards() {
  return (
    <Shell>
      <RewardsView />
    </Shell>
  );
}
