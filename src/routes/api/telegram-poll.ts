import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram-poll")({
  server: {
    handlers: {
      GET: async () => {
        const { pollLinkedClubs } = await import("@/lib/stockclub/news.server");
        const result = await pollLinkedClubs();
        return Response.json({ ok: true, every: "5m", ...result });
      },
    },
  },
});
