import { createFileRoute } from "@tanstack/react-router";

type Update = {
  message?: {
    text?: string;
    chat?: { id?: number; type?: string };
    from?: { id?: number };
  };
  my_chat_member?: {
    chat?: { id?: number; type?: string };
    from?: { id?: number };
    old_chat_member?: { status?: string };
    new_chat_member?: { status?: string };
  };
};

async function reply(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => undefined);
}

async function leave(chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/leaveChat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  }).catch(() => undefined);
}

export const Route = createFileRoute("/api/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
        if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
          return new Response("no", { status: 401 });
        }
        const update = (await request.json().catch(() => null)) as Update | null;
        const { verifyTelegramCode, linkVerifiedGroup } = await import("@/lib/stockclub/news.server");

        const message = update?.message;
        if (message?.chat?.type === "private" && message.chat.id != null && message.from?.id != null) {
          const text = message.text?.trim() ?? "";
          const started = text.match(/^\/start(?:@\S+)?(?:\s+([0-9]{6}))?/);
          const code = started?.[1] ?? (text.match(/^[0-9]{6}$/) ? text : "");
          if (!code) {
            await reply(message.chat.id, "Send the 6 digit code from your club page. Only the club creator gets one, and it lasts 10 minutes.");
            return Response.json({ ok: true });
          }
          const checked = await verifyTelegramCode(code, String(message.from.id));
          await reply(
            message.chat.id,
            checked.ok
              ? `${checked.ticker} is verified. Add me to your Telegram group now, before the code expires.`
              : checked.reason,
          );
          return Response.json({ ok: true, verified: checked.ok });
        }

        const member = update?.my_chat_member;
        const chat = member?.chat;
        const group = chat?.type === "group" || chat?.type === "supergroup";
        const status = member?.new_chat_member?.status;
        const previous = member?.old_chat_member?.status;
        const joined = (status === "member" || status === "administrator") && previous !== "member" && previous !== "administrator";
        if (!group || !joined || chat?.id == null || member?.from?.id == null) return Response.json({ ok: true });

        const linked = await linkVerifiedGroup(String(member.from.id), String(chat.id));
        if (linked.ok) {
          await reply(chat.id, `${linked.ticker} is linked. New headlines are pushed here on their own every 5 minutes, up or down.`);
          return Response.json({ ok: true, linked: true });
        }
        await reply(chat.id, linked.reason);
        await leave(chat.id);
        return Response.json({ ok: true, linked: false });
      },
    },
  },
});
