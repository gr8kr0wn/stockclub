import { createFileRoute } from "@tanstack/react-router";

function tokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+([a-f0-9]{32,})$/i);
  return match?.[1] ?? null;
}

export const Route = createFileRoute("/api/world")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { loadWorld } = await import("@/lib/stockclub/world.server");
        try {
          return Response.json(await loadWorld(tokenFrom(request)));
        } catch (error) {
          const message = error instanceof Error ? error.message : "World unavailable";
          return Response.json({ clubs: [], proposals: [], challenges: [], posts: [], contributions: [], members: [], registry: null, me: emptyMe(), error: message }, { status: 500 });
        }
      },
      POST: async ({ request }) => {
        const { handleWorld } = await import("@/lib/stockclub/world.server");
        const body = (await request.json()) as Record<string, unknown>;
        try {
          const result = await handleWorld(tokenFrom(request), body);
          return Response.json(result, { status: result.ok ? 200 : 400 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not save that.";
          return Response.json({ ok: false, reason: message }, { status: 500 });
        }
      },
    },
  },
});

function emptyMe() {
  return { address: null, joined: [], minted: [], votes: {}, entered: [], cheers: [], hidden: [], points: 0 };
}
