export type Membership = "free" | "collectible";

export type Split = { members: number; ops: number; founder: number };

export type Club = {
  ticker: string;
  name: string;
  tagline: string;
  description: string;
  rules: string;
  membership: Membership;
  members: number;
  treasuryUsdc: number;
  treasuryStock: number;
  weeklyActivity: number;
  score: number;
  price: string;
  change: string;
  up: boolean;
  points: number[];
  cover: string;
  founded: string;
  founder: string;
  founderAddress: string;
  split: Split;
  stockSymbol: string | null;
  stockName: string | null;
  telegram: string | null;
  xHandle: string | null;
  discord: string | null;
  telegramLinked: boolean;
};

export type Post = {
  id: string;
  ticker: string;
  author: string;
  kind: "meme" | "research" | "update";
  body: string;
  likes: number;
};

export type Proposal = {
  id: string;
  ticker: string;
  title: string;
  body: string;
  yes: number;
  no: number;
  daysLeft: number;
  recipient: string | null;
  amount: number | null;
  chainId: number | null;
  executed: boolean;
};

export type Challenge = {
  id: string;
  ticker: string;
  title: string;
  detail: string;
  reward: string;
  entries: number;
};

export type Contribution = {
  id: string;
  ticker: string;
  address: string;
  amount: number;
  at: string;
};

export type Wallet = { address: string; name: string };

export type MemberRow = { ticker: string; address: string; role: string };

export const COVERS = [
  "/media/nvda.jpg",
  "/media/tsla.jpg",
  "/media/aapl.jpg",
  "/media/stonks.jpg",
  "/media/base.jpg",
];

export const SEED: Club[] = [];

export function money(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `$${v >= 10 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) {
    const v = n / 1_000;
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)}K`;
  }
  return String(n);
}

export function socialHref(kind: "telegram" | "x" | "discord", raw: string | null): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  if (kind === "telegram") {
    if (/^https:\/\/(t\.me|telegram\.me)\//i.test(value)) return value;
    const handle = value.replace(/^@/, "");
    if (/^[A-Za-z0-9_]{3,32}$/.test(handle)) return `https://t.me/${handle}`;
  }
  if (kind === "x") {
    if (/^https:\/\/(x\.com|twitter\.com)\//i.test(value)) return value;
    const handle = value.replace(/^@/, "");
    if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) return `https://x.com/${handle}`;
  }
  if (kind === "discord") {
    if (/^https:\/\/(discord\.gg|discord\.com)\//i.test(value)) return value;
    if (/^[A-Za-z0-9-]{2,40}$/.test(value)) return `https://discord.gg/${value}`;
  }
  return null;
}

export function tickerFromSymbol(symbol: string): string {
  const head = symbol.split(/[-.]/)[0]?.replace(/[^A-Za-z]/g, "") ?? "";
  const letters = (head || symbol.replace(/[^A-Za-z]/g, "")).toUpperCase();
  return letters.slice(0, 5);
}

export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function allClubs(extras: Club[]): Club[] {
  const seen = new Set<string>();
  const out: Club[] = [];
  for (const club of [...extras, ...SEED]) {
    if (seen.has(club.ticker)) continue;
    seen.add(club.ticker);
    out.push(club);
  }
  return out;
}

export function findClub(ticker: string, extras: Club[]): Club | null {
  const key = ticker.toUpperCase();
  return allClubs(extras).find((club) => club.ticker === key) ?? null;
}

export function membersOf(club: Club, bumps: Record<string, number>): number {
  return club.members + (bumps[club.ticker] ?? 0);
}

export function treasuryOf(
  club: Club,
  usdcAdd: Record<string, number>,
  stockAdd: Record<string, number>,
): { usdc: number; stock: number; total: number } {
  const usdc = club.treasuryUsdc + (usdcAdd[club.ticker] ?? 0);
  const stock = club.treasuryStock + (stockAdd[club.ticker] ?? 0);
  return { usdc, stock, total: usdc + stock };
}

export function scoreOf(
  club: Club,
  bumps: Record<string, number>,
  usdcAdd: Record<string, number>,
): number {
  return club.score + (bumps[club.ticker] ?? 0) * 12 + Math.round((usdcAdd[club.ticker] ?? 0) / 5_000);
}
