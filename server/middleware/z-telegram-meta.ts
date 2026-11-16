/**
 * Telegram reads Open Graph tags from the raw HTML. The platform head injector
 * removes them and will not add og:image on a *.vercel.app host, so this
 * middleware puts the StockClub card back after that pass.
 */
const TAGS = [
  '<meta property="og:site_name" content="StockClub">',
  '<meta property="og:title" content="StockClub">',
  '<meta property="og:description" content="A club and a treasury for every stock. Members hold USDC together on Base.">',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="https://stockclub-eta.vercel.app/">',
  '<meta property="og:image" content="https://stockclub-eta.vercel.app/og.jpg">',
  '<meta property="og:image:secure_url" content="https://stockclub-eta.vercel.app/og.jpg">',
  '<meta property="og:image:type" content="image/jpeg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="StockClub">',
  '<meta name="twitter:description" content="A club and a treasury for every stock.">',
  '<meta name="twitter:image" content="https://stockclub-eta.vercel.app/og.jpg">',
].join("");

interface EventLike {
  req: { method?: string };
}

export default async function telegramMeta(
  event: EventLike,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();
  const result = await next();
  if (!(result instanceof Response)) return result;
  const type = result.headers.get("content-type") ?? "";
  if (!type.includes("text/html") || !result.body) return result;
  const html = await result.text();
  if (html.includes("https://stockclub-eta.vercel.app/og.jpg")) return htmlResponse(result, html);
  const nextHtml = /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, (open) => `${open}${TAGS}`)
    : html;
  return htmlResponse(result, nextHtml);
}

function htmlResponse(source: Response, html: string): Response {
  const headers = new Headers(source.headers);
  headers.delete("content-length");
  return new Response(html, { status: source.status, statusText: source.statusText, headers });
}
