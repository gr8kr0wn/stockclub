import { createFileRoute } from "@tanstack/react-router";

type Update = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
  };
};

export const Route = createFileRoute("/api/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
        if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("no", { status: 401 });
        }
        const update = (await request.json().catch(() => null)) as Update | null;
        const text = update?.message?.text?.trim() ?? "";
        const chat = update?.message?.chat;
        const group = chat?.type === "group" || chat?.type === "supergroup";
        const match = text.match(/^\/link(?:@\S+)?\s+([A-Za-z]{1,5})\b/);
        if (!group || !match || chat?.id == null) return Response.json({ ok: true });
        const { linkTelegram } = await import("@/lib/stockclub/news.server");
        const ticker = match[1].toUpperCase();
        const linked = await linkTelegram(ticker, String(chat.id));
        const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
        if (token) {
          const note = linked
            ? `${ticker} is linked. New headlines are pushed here on their own every 5 minutes, up or down. Nobody has to ask.`
            : `${ticker} is not a club yet.`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ chat_id: chat.id, text: note }),
          }).catch(() => undefined);
        }
        return Response.json({ ok: true, linked });
      },
    },
  },
});
