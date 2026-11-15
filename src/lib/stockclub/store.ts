import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Club, Contribution, Membership, Post, Split, Wallet } from "./model";
import { findClub } from "./model";

export type CreateInput = {
  name: string;
  ticker: string;
  description: string;
  rules: string;
  membership: Membership;
  split: Split;
  cover: string;
};

type Result = { ok: true } | { ok: false; reason: string };

type StockState = {
  wallet: Wallet | null;
  joined: string[];
  minted: string[];
  extras: Club[];
  bumps: Record<string, number>;
  usdcAdd: Record<string, number>;
  stockAdd: Record<string, number>;
  contributions: Contribution[];
  votes: Record<string, "yes" | "no">;
  posts: Post[];
  hidden: string[];
  entered: string[];
  cheers: string[];
  connectOpen: boolean;
  notice: string | null;
  query: string;
  openConnect: () => void;
  closeConnect: () => void;
  setNotice: (notice: string | null) => void;
  setQuery: (query: string) => void;
  connect: (kind: "browser" | "coinbase") => void;
  disconnect: () => void;
  join: (ticker: string) => Result;
  mintAndJoin: (ticker: string) => Result;
  createClub: (input: CreateInput) => Result & { ticker?: string };
  contribute: (ticker: string, amount: number) => Result;
  vote: (id: string, choice: "yes" | "no") => Result;
  publish: (ticker: string, kind: Post["kind"], body: string) => Result;
  hidePost: (id: string) => Result;
  enterChallenge: (id: string, ticker: string) => Result;
  cheer: (ticker: string) => Result;
};

function randomAddress(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function handleFrom(address: string): string {
  return `bull${address.slice(2, 6)}`;
}

function requireWallet(wallet: Wallet | null): Result | null {
  if (!wallet) return { ok: false, reason: "Connect a wallet first." };
  return null;
}

export const useStock = create<StockState>()(
  persist(
    (set, get) => ({
      wallet: null,
      joined: [],
      minted: [],
      extras: [],
      bumps: {},
      usdcAdd: {},
      stockAdd: {},
      contributions: [],
      votes: {},
      posts: [],
      hidden: [],
      entered: [],
      cheers: [],
      connectOpen: false,
      notice: null,
      query: "",
      openConnect: () => set({ connectOpen: true }),
      closeConnect: () => set({ connectOpen: false }),
      setNotice: (notice) => set({ notice }),
      setQuery: (query) => set({ query }),
      connect: (kind) => {
        const address = randomAddress();
        const name = kind === "coinbase" ? `base${address.slice(2, 6)}` : handleFrom(address);
        set({
          wallet: { address, name },
          connectOpen: false,
          notice: `Connected ${name} on Base.`,
        });
      },
      disconnect: () => set({ wallet: null, notice: "Wallet disconnected." }),
      join: (ticker) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const club = findClub(ticker, get().extras);
        if (!club) return { ok: false, reason: "Club not found." };
        if (get().joined.includes(club.ticker)) return { ok: false, reason: "Already a member." };
        if (club.membership === "collectible" && !get().minted.includes(club.ticker)) {
          return { ok: false, reason: "This club uses a collectible membership. Mint it first." };
        }
        set({
          joined: [...get().joined, club.ticker],
          bumps: { ...get().bumps, [club.ticker]: (get().bumps[club.ticker] ?? 0) + 1 },
          notice: `You joined ${club.name}.`,
        });
        return { ok: true };
      },
      mintAndJoin: (ticker) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const club = findClub(ticker, get().extras);
        if (!club) return { ok: false, reason: "Club not found." };
        if (get().joined.includes(club.ticker)) return { ok: false, reason: "Already a member." };
        const minted = get().minted.includes(club.ticker)
          ? get().minted
          : [...get().minted, club.ticker];
        set({
          minted,
          joined: [...get().joined, club.ticker],
          bumps: { ...get().bumps, [club.ticker]: (get().bumps[club.ticker] ?? 0) + 1 },
          notice: `Membership collected. Welcome to ${club.name}.`,
        });
        return { ok: true };
      },
      createClub: (input) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const ticker = input.ticker.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
        if (!ticker) return { ok: false, reason: "Ticker needs letters." };
        if (!input.name.trim()) return { ok: false, reason: "Club name is required." };
        if (input.description.trim().length < 12) {
          return { ok: false, reason: "Describe the club in a sentence." };
        }
        const splitTotal = input.split.members + input.split.ops + input.split.founder;
        if (splitTotal !== 100) return { ok: false, reason: "Revenue split must add up to 100." };
        if (findClub(ticker, get().extras)) return { ok: false, reason: "That ticker already has a club." };
        const club: Club = {
          ticker,
          name: input.name.trim(),
          tagline: input.description.trim().slice(0, 42),
          description: input.description.trim(),
          rules: input.rules.trim() || "Be useful. No spam. No fake volume.",
          membership: input.membership,
          members: 1,
          treasuryUsdc: 0,
          treasuryStock: 0,
          weeklyActivity: 1,
          score: 100,
          price: "—",
          change: "New",
          up: true,
          points: [4, 5, 5, 6, 7, 7, 8, 9],
          cover: input.cover,
          founded: new Date().toISOString().slice(0, 10),
          founder: get().wallet?.name ?? "you",
          split: input.split,
        };
        set({
          extras: [club, ...get().extras],
          joined: [...get().joined, ticker],
          notice: `${club.name} is live. You are the founding admin.`,
        });
        return { ok: true, ticker };
      },
      contribute: (ticker, amount) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const club = findClub(ticker, get().extras);
        if (!club) return { ok: false, reason: "Club not found." };
        if (!get().joined.includes(club.ticker)) return { ok: false, reason: "Join the club before contributing." };
        if (!Number.isFinite(amount) || amount < 1) return { ok: false, reason: "Enter at least 1 USDC." };
        if (amount > 1_000_000) return { ok: false, reason: "Demo cap is 1,000,000 USDC." };
        const whole = Math.round(amount);
        const row: Contribution = {
          id: `tx-${Date.now()}`,
          ticker: club.ticker,
          amount: whole,
          at: new Date().toISOString(),
        };
        set({
          contributions: [row, ...get().contributions],
          usdcAdd: { ...get().usdcAdd, [club.ticker]: (get().usdcAdd[club.ticker] ?? 0) + whole },
          notice: `${whole.toLocaleString("en-US")} USDC simulated into ${club.ticker}.`,
        });
        return { ok: true };
      },
      vote: (id, choice) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        if (get().votes[id]) return { ok: false, reason: "You already voted on this proposal." };
        const proposalTicker = id.split("-")[0]?.toUpperCase();
        if (proposalTicker && !get().joined.includes(proposalTicker) && !id.startsWith("user-")) {
          const club = findClub(proposalTicker, get().extras);
          if (club && !get().joined.includes(club.ticker)) {
            return { ok: false, reason: "Join the club to vote." };
          }
        }
        set({ votes: { ...get().votes, [id]: choice }, notice: choice === "yes" ? "Voted yes." : "Voted no." });
        return { ok: true };
      },
      publish: (ticker, kind, body) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const club = findClub(ticker, get().extras);
        if (!club) return { ok: false, reason: "Club not found." };
        if (!get().joined.includes(club.ticker)) return { ok: false, reason: "Members only." };
        const text = body.trim();
        if (text.length < 4) return { ok: false, reason: "Write something first." };
        const post: Post = {
          id: `u-${Date.now()}`,
          ticker: club.ticker,
          author: get().wallet?.name ?? "you",
          kind,
          body: text,
          likes: 0,
        };
        set({ posts: [post, ...get().posts], notice: "Posted to the club." });
        return { ok: true };
      },
      hidePost: (id) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        set({ hidden: [...get().hidden, id], notice: "Post hidden." });
        return { ok: true };
      },
      enterChallenge: (id, ticker) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const club = findClub(ticker, get().extras);
        if (!club || !get().joined.includes(club.ticker)) return { ok: false, reason: "Join the club to enter." };
        if (get().entered.includes(id)) return { ok: false, reason: "You already entered." };
        set({ entered: [...get().entered, id], notice: "You're in. One entry is enough." });
        return { ok: true };
      },
      cheer: (ticker) => {
        const blocked = requireWallet(get().wallet);
        if (blocked) return blocked;
        const club = findClub(ticker, get().extras);
        if (!club) return { ok: false, reason: "Club not found." };
        if (get().cheers.includes(club.ticker)) return { ok: false, reason: "One cheer per club." };
        set({ cheers: [...get().cheers, club.ticker], notice: `You backed ${club.name}.` });
        return { ok: true };
      },
    }),
    {
      name: "stockclub-v1",
      skipHydration: true,
      partialize: (state) => ({
        wallet: state.wallet,
        joined: state.joined,
        minted: state.minted,
        extras: state.extras,
        bumps: state.bumps,
        usdcAdd: state.usdcAdd,
        stockAdd: state.stockAdd,
        contributions: state.contributions,
        votes: state.votes,
        posts: state.posts,
        hidden: state.hidden,
        entered: state.entered,
        cheers: state.cheers,
      }),
    },
  ),
);
