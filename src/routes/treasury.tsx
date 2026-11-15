import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { TreasuryView } from "@/components/pages";

export const Route = createFileRoute("/treasury")({ component: Treasury });

function Treasury() {
  return (
    <Shell>
      <TreasuryView />
    </Shell>
  );
}
