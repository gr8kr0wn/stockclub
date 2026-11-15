import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { LeaderboardView } from "@/components/pages";

export const Route = createFileRoute("/leaderboard")({ component: Leaderboard });

function Leaderboard() {
  return (
    <Shell>
      <LeaderboardView />
    </Shell>
  );
}
