import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "StockClub";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#07080b" },
      { name: "description", content: "A club and a treasury for every stock. Members hold USDC together on Base. Money leaves only after a vote." },
      { property: "og:title", content: "StockClub" },
      { property: "og:description", content: "A club and a treasury for every stock. Members hold USDC together on Base." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://stockclub-eta.vercel.app" },
      { property: "og:image", content: "https://stockclub-eta.vercel.app/og.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "StockClub" },
      { name: "twitter:description", content: "A club and a treasury for every stock." },
      { name: "twitter:image", content: "https://stockclub-eta.vercel.app/og.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "180x180", href: "/favicon-180.png" },
      { rel: "apple-touch-icon", href: "/favicon-180.png" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
