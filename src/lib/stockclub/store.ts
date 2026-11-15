import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Challenge, Club, Contribution, MemberRow, Membership, Post, Proposal, Split, Wallet } from "./model";
import { CLUB_REGISTRY } from "./chain";
import { connectAccount, deployTreasury, depositUsdc, signIn } from "./wallet";

export type CreateInput = {
  name: string;
  ticker: string;
  description: string;
  rules: string;
  membership: Membership;
  split: Split;
  cover: string;
};

type Result = { ok: true; ticker?: string } | { ok: false; reason: string };

type StockState = {
  wallet: Wallet | null;
  token: string | null;
  providerKind: "browser" | "coinbase" | null;
  joined: string[];
  minted: string[];
  extras: Club[];
  proposals: Proposal[];
  challenges: Challenge[];
  posts: Post[];
  contributions: Contribution[];
  members: MemberRow[];
  votes: Record<string, "yes" | "no">;
  entered: string[];
  cheers: string[];
  hidden: string[];
  points: number;
  registry: string | null;
  bumps: Record<string, number>;
  usdcAdd: Record<string, number>;
  stockAdd: Record<string, number>;
  connectOpen: boolean;
  connectError: string | null;
  busy: boolean;
  notice: string | null;
  query: string;
  openConnect: () => void;
  closeConnect: () => void;
  setNotice: (notice: string | null) => void;
  setQuery: (query: string) => void;
  refresh: () => Promise<void>;
  connect: (kind: "browser" | "coinbase") => Promise<void>;
  disconnect: () => Promise<void>;
  join: (ticker: string) => Promise<Result>;
  mintAndJoin: (ticker: string) => Promise<Result>;
  createClub: (input: CreateInput) => Promise<Result>;
  contribute: (ticker: string, amount: number) => Promise<Result>;
  deploy: () => Promise<Result>;
  propose: (ticker: string, title: string, body: string, days: number) => Promise<Result>;
  vote: (id: string, choice: "yes" | "no") => Promise<Result>;
  challenge: (ticker: string, title: string, detail: string, reward: string) => Promise<Result>;
  publish: (ticker: string, kind: Post["kind"], body: string) => Promise<Result>;
  hidePost: (id: string) => Promise<Result>;
  enterChallenge: (id: string, ticker: string) => Promise<Result>;
  cheer: (ticker: string) => Promise<Result>;
};

function worldUrl(): string {
  if (typeof window === "undefined") return "/api/world";
  const prefix = window.location.pathname.match(/^\/hds-[a-z0-9]+-\d+-[a-z0-9]+/i)?.[0] ?? "";
  return `${prefix}/api/world`;
}

async function post(body: Record<string, unknown>, token: string | null): Promise<Result> {
  const response = await fetch(worldUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Result;
  if (!data || typeof data.ok !== "boolean") return { ok: false, reason: "The club network did not answer." };
  return data;
}

const emptyMe = {
  joined: [] as string[],
  minted: [] as string[],
  votes: {} as Record<string, "yes" | "no">,
  entered: [] as string[],
  cheers: [] as string[],
  hidden: [] as string[],
  points: 0,
};

export const useStock = create<StockState>()(
  persist(
    (set, get) => ({
      wallet: null,
      token: null,
      providerKind: null,
      joined: [],
      minted: [],
      extras: [],
      proposals: [],
      challenges: [],
      posts: [],
      contributions: [],
      members: [],
      votes: {},
      entered: [],
      cheers: [],
      hidden: [],
      points: 0,
      registry: CLUB_REGISTRY,
      bumps: {},
      usdcAdd: {},
      stockAdd: {},
      connectOpen: false,
      connectError: null,
      busy: false,
      notice: null,
      query: "",
      openConnect: () => set({ connectOpen: true, connectError: null }),
      closeConnect: () => set({ connectOpen: false }),
      setNotice: (notice) => set({ notice }),
      setQuery: (query) => set({ query }),
      refresh: async () => {
        try {
          const token = get().token;
          const response = await fetch(worldUrl(), {
            headers: token ? { authorization: `Bearer ${token}` } : {},
          });
          if (!response.ok) return;
          const data = (await response.json()) as {
            clubs: Club[];
            proposals: Proposal[];
            challenges: Challenge[];
            posts: Post[];
            contributions: Contribution[];
            members: MemberRow[];
            registry: string | null;
            me: typeof emptyMe & { address: string | null };
          };
          set({
            extras: data.clubs ?? [],
            proposals: data.proposals ?? [],
            challenges: data.challenges ?? [],
            posts: data.posts ?? [],
            contributions: data.contributions ?? [],
            members: data.members ?? [],
            registry: data.registry ?? CLUB_REGISTRY,
            joined: data.me?.joined ?? [],
            minted: data.me?.minted ?? [],
            votes: data.me?.votes ?? {},
            entered: data.me?.entered ?? [],
            cheers: data.me?.cheers ?? [],
            hidden: data.me?.hidden ?? [],
            points: data.me?.points ?? 0,
          });
          if (token && data.me && !data.me.address) set({ wallet: null, token: null });
        } catch {
          set({ notice: "Clubs could not be loaded." });
        }
      },
      connect: async (kind) => {
        set({ busy: true, connectError: null });
        try {
          const { provider, address } = await connectAccount(kind);
          const nonce = (await post({ action: "nonce", address }, null)) as Result & { message?: string };
          if (!nonce.ok) {
            set({ connectError: nonce.reason, busy: false });
            return;
          }
          const signature = await signIn(provider, address, nonce.message ?? "");
          const session = (await post({ action: "session", address, signature }, null)) as Result & { token?: string };
          if (!session.ok || !session.token) {
            set({ connectError: session.ok ? "No session came back." : session.reason, busy: false });
            return;
          }
          set({
            wallet: { address: address.toLowerCase(), name: `${address.slice(0, 6)}…${address.slice(-4)}` },
            token: session.token,
            providerKind: kind,
            connectOpen: false,
            busy: false,
            notice: "Wallet signed in on Base.",
          });
          await get().refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Wallet connection failed.";
          set({ connectError: message, busy: false });
        }
      },
      disconnect: async () => {
        const token = get().token;
        if (token) await post({ action: "logout" }, token).catch(() => undefined);
        set({ wallet: null, token: null, providerKind: null, ...emptyMe, notice: "Wallet disconnected." });
      },
      join: (ticker) => act(get, set, { action: "join", ticker }, "You joined the club."),
      mintAndJoin: (ticker) => act(get, set, { action: "mint", ticker }, "Membership collected."),
      createClub: (input) =>
        act(
          get,
          set,
          {
            action: "createClub",
            name: input.name,
            ticker: input.ticker,
            description: input.description,
            rules: input.rules,
            membership: input.membership,
            cover: input.cover,
            members: input.split.members,
            ops: input.split.ops,
            founder: input.split.founder,
          },
          "Club is live. You are the founding admin.",
        ),
      contribute: async (ticker, amount) => {
        const whole = Math.round(amount);
        const kind = get().providerKind;
        if (!get().wallet || !kind) return { ok: false, reason: "Connect a wallet first." };
        if (!get().registry) return { ok: false, reason: "Deploy the treasury contract before sending USDC." };
        set({ busy: true });
        try {
          const { provider, address } = await connectAccount(kind);
          const txHash = await depositUsdc(provider, address, get().registry as `0x${string}`, ticker, whole);
          return act(get, set, { action: "contribute", ticker, amount: whole, txHash }, "USDC is in the Base treasury.");
        } catch (error) {
          const message = error instanceof Error ? error.message : "The wallet rejected the transfer.";
          set({ busy: false, notice: message });
          return { ok: false, reason: message };
        }
      },
      deploy: async () => {
        const kind = get().providerKind;
        if (!get().wallet || !kind) return { ok: false, reason: "Connect a wallet first." };
        set({ busy: true });
        try {
          const { provider, address } = await connectAccount(kind);
          const txHash = await deployTreasury(provider, address);
          return act(get, set, { action: "registry", txHash }, "Treasury contract is on Base.");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Deploy was rejected.";
          set({ busy: false, notice: message });
          return { ok: false, reason: message };
        }
      },
      propose: (ticker, title, body, days) => act(get, set, { action: "propose", ticker, title, body, days }, "Proposal is open."),
      vote: (id, choice) => act(get, set, { action: "vote", id, choice }, choice === "yes" ? "Voted yes." : "Voted no."),
      challenge: (ticker, title, detail, reward) =>
        act(get, set, { action: "challenge", ticker, title, detail, reward }, "Challenge is up."),
      publish: (ticker, kind, body) => act(get, set, { action: "post", ticker, kind, body }, "Posted to the club."),
      hidePost: (id) => act(get, set, { action: "hide", id }, "Post hidden."),
      enterChallenge: (id) => act(get, set, { action: "enter", id }, "You're in. One entry is enough."),
      cheer: (ticker) => act(get, set, { action: "cheer", ticker }, "You backed the club."),
    }),
    {
      name: "stockclub-v2",
      skipHydration: true,
      partialize: (state) => ({
        wallet: state.wallet,
        token: state.token,
        providerKind: state.providerKind,
      }),
    },
  ),
);

async function act(
  get: () => StockState,
  set: (partial: Partial<StockState>) => void,
  body: Record<string, unknown>,
  notice: string,
): Promise<Result> {
  if (!get().token) return { ok: false, reason: "Connect a wallet first." };
  set({ busy: true });
  const result = await post(body, get().token);
  if (!result.ok) {
    set({ busy: false, notice: result.reason });
    return result;
  }
  await get().refresh();
  set({ busy: false, notice });
  return result;
}
