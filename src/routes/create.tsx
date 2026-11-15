import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { CreateView } from "@/components/pages";

export const Route = createFileRoute("/create")({ component: Create });

function Create() {
  return (
    <Shell>
      <CreateView />
    </Shell>
  );
}
