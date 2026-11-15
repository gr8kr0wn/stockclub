import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { HomeView } from "@/components/home-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <HomeView />
    </Shell>
  );
}
