import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q") ?? "";
        const { searchStocks } = await import("@/lib/stockclub/search.server");
        return Response.json({ stocks: await searchStocks(q) });
      },
    },
  },
});
