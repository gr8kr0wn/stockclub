import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/market")({
  server: {
    handlers: {
      GET: async () => {
        const { loadMarket } = await import("@/lib/stockclub/market.server");
        return Response.json(await loadMarket());
      },
    },
  },
});
