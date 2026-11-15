import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { ClubView } from "@/components/club-view";

export const Route = createFileRoute("/club/$ticker")({
  component: ClubPage,
});

function ClubPage() {
  const { ticker } = Route.useParams();
  return (
    <Shell>
      <ClubView ticker={ticker} />
    </Shell>
  );
}
