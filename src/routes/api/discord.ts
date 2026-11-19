import { createPublicKey, verify } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

type Interaction = {
  type?: number;
  data?: { name?: string; options?: Array<{ name?: string; value?: string }> };
  channel_id?: string;
};

function verifyDiscord(body: string, signature: string, timestamp: string, keyHex: string): boolean {
  if (!keyHex || !signature || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(keyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + body), key, Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/discord")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-signature-ed25519") ?? "";
        const timestamp = request.headers.get("x-signature-timestamp") ?? "";
        const { discordPublicKey, linkDiscordChannel } = await import("@/lib/stockclub/news.server");
        const key = (await discordPublicKey()) ?? process.env.DISCORD_PUBLIC_KEY?.trim() ?? "";
        if (!verifyDiscord(raw, signature, timestamp, key)) return new Response("bad signature", { status: 401 });
        const interaction = JSON.parse(raw) as Interaction;
        if (interaction.type === 1) return Response.json({ type: 1 });
        if (interaction.type !== 2 || interaction.data?.name !== "link") {
          return Response.json({ type: 4, data: { content: "Use /link and the 6 digit code from your club page.", flags: 64 } });
        }
        const code = interaction.data.options?.find((item) => item.name === "code")?.value?.trim() ?? "";
        const channel = interaction.channel_id;
        if (!/^[0-9]{6}$/.test(code) || !channel) {
          return Response.json({ type: 4, data: { content: "Send the 6 digit code from your club page.", flags: 64 } });
        }
        const { linkDiscordChannel: link } = await import("@/lib/stockclub/news.server");
        const linked = await link(code, channel);
        return Response.json({
          type: 4,
          data: {
            content: linked.ok
              ? `${linked.ticker} is linked. New headlines are pushed here on their own.`
              : linked.reason,
          },
        });
      },
    },
  },
});
