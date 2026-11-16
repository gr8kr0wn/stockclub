import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/news")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const { loadDesk } = await import("@/lib/stockclub/news.server");
        const desk = await loadDesk(url.searchParams.get("symbol"), url.searchParams.get("ticker"));
        return Response.json(desk);
      },
    },
  },
});
