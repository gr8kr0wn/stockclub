import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { FaqView } from "@/components/faq-view";

export const Route = createFileRoute("/faq")({
  component: Faq,
  head: () => ({
    meta: [{ title: "StockClub help" }, { name: "description", content: "How to add an account, create a club, deposit, and request a payout." }],
  }),
});

function Faq() {
  return (
    <Shell>
      <FaqView />
    </Shell>
  );
}
