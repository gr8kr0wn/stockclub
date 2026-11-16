import { createFileRoute } from "@tanstack/react-router";
import { LandingView } from "@/components/landing-view";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "StockClub. A club and a treasury for every stock." },
      {
        name: "description",
        content: "StockClub gives any ticker its own club and its own USDC treasury on Base. Money leaves only after a vote.",
      },
    ],
  }),
});

function Landing() {
  return <LandingView />;
}
