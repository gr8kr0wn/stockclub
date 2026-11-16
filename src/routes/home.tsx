import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { HomeView } from "@/components/home-view";

export const Route = createFileRoute("/home")({ component: AppHome });

function AppHome() {
  return (
    <Shell>
      <HomeView />
    </Shell>
  );
}
