import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { GovernanceView } from "@/components/pages";

export const Route = createFileRoute("/governance")({ component: Governance });

function Governance() {
  return (
    <Shell>
      <GovernanceView />
    </Shell>
  );
}
