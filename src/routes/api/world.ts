import { createFileRoute } from "@tanstack/react-router";
import { CLUB_REGISTRY } from "@/lib/stockclub/chain";

function tokenFrom(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+([a-f0-9]{32,})$/i);
  return match?.[1] ?? null;
}

function emptyWorld(error?: string) {
  return {
    clubs: [],
    proposals: [],
    challenges: [],
    posts: [],
    contributions: [],
    members: [],
    registry: CLUB_REGISTRY,
    me: emptyMe(),
    ...(error ? { error } : {}),
  };
}

export const Route = createFileRoute("/api/world")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { loadWorld } = await import("@/lib/stockclub/world.server");
        try {
          const world = await loadWorld(tokenFrom(request));
          return Response.json({ ...world, registry: world.registry ?? CLUB_REGISTRY });
        } catch (error) {
          const message = error instanceof Error ? error.message : "World unavailable";
          return Response.json(emptyWorld(message));
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
          const reason = message.includes("pglite") || message.includes("ENOENT")
            ? "The public site has no database yet, so this could not be saved."
            : message;
          return Response.json({ ok: false, reason }, { status: 500 });
        }
      },
    },
  },
});

function emptyMe() {
  return { address: null, joined: [], minted: [], votes: {}, entered: [], cheers: [], hidden: [], points: 0 };
}