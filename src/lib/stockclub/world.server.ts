import { getAddress, isAddress, keccak256, toBytes, verifyMessage } from "viem";
import { getSql } from "@/lib/db";
import { CLUB_DEPLOYED_BYTECODE } from "./club-bytecode";
import { BASE_RPC, BASE_USDC, CLUB_REGISTRY, signInMessage } from "./chain";
import { shortAddr, type Challenge, type Club, type Contribution, type MemberRow, type Membership, type Post, type Proposal } from "./model";

const TRANSFER_TOPIC = keccak256(toBytes("Transfer(address,address,uint256)"));

type Result = { ok: true; ticker?: string; token?: string; nonce?: string; message?: string } | { ok: false; reason: string };

export type World = {
  clubs: Club[];
  proposals: Proposal[];
  challenges: Challenge[];
  posts: Post[];
  contributions: Contribution[];
  members: MemberRow[];
  registry: string | null;
  me: {
    address: string | null;
    joined: string[];
    minted: string[];
    votes: Record<string, "yes" | "no">;
    entered: string[];
    cheers: string[];
    hidden: string[];
    points: number;
  };
};

function fail(reason: string): Result {
  return { ok: false, reason };
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function day(value: unknown): string {
  return iso(value).slice(0, 10);
}

function cleanTicker(value: unknown): string | null {
  const ticker = String(value ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
  return ticker.length > 0 ? ticker : null;
}

function cleanAddress(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!isAddress(raw)) return null;
  return getAddress(raw).toLowerCase();
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message ?? "Base RPC failed");
  return data.result;
}

async function actor(token: string | null): Promise<string | null> {
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql<{ address: string }>`
    select address from wallet_sessions where token = ${token} and expires_at > now()
  `;
  return rows[0]?.address ?? null;
}

export async function loadWorld(token: string | null): Promise<World> {
  const sql = await getSql();
  const address = await actor(token);
  const clubs = await sql<{
    ticker: string;
    name: string;
    description: string;
    rules: string;
    membership: string;
    founder: string;
    cover: string;
    members_split: number;
    ops_split: number;
    founder_split: number;
    stock_symbol: string | null;
    stock_name: string | null;
    telegram: string | null;
    x_handle: string | null;
    discord: string | null;
    telegram_chat: string | null;
    created_at: unknown;
  }>`select ticker, name, description, rules, membership, founder, cover, members_split, ops_split, founder_split, stock_symbol, stock_name, telegram, x_handle, discord, telegram_chat, created_at from clubs order by created_at desc`;
  const memberRows = await sql<{ ticker: string; address: string; minted: boolean }>`
    select ticker, address, minted from members order by created_at
  `;
  const contributionRows = await sql<{ id: string; ticker: string; address: string; amount: number; created_at: unknown }>`
    select id, ticker, address, amount, created_at from contributions order by created_at desc
  `;
  const proposalRows = await sql<{ id: string; ticker: string; title: string; body: string; closes_at: unknown }>`
    select id, ticker, title, body, closes_at from proposals order by created_at desc
  `;
  const voteRows = await sql<{ proposal_id: string; address: string; choice: string }>`
    select proposal_id, address, choice from votes
  `;
  const challengeRows = await sql<{ id: string; ticker: string; author: string; title: string; detail: string; reward: string }>`
    select id, ticker, author, title, detail, reward from challenges order by created_at desc
  `;
  const entryRows = await sql<{ challenge_id: string; address: string }>`select challenge_id, address from entries`;
  const postRows = await sql<{ id: string; ticker: string; author: string; kind: string; body: string; hidden: boolean }>`
    select id, ticker, author, kind, body, hidden from posts order by created_at desc
  `;
  const cheerRows = await sql<{ ticker: string; address: string }>`select ticker, address from cheers`;
  const config = await sql<{ registry: string | null }>`select registry from chain_config where id = 1`;

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const mapped: Club[] = clubs.map((row) => {
    const members = memberRows.filter((item) => item.ticker === row.ticker).length;
    const usdc = contributionRows.filter((item) => item.ticker === row.ticker).reduce((sum, item) => sum + Number(item.amount), 0);
    const posts = postRows.filter((item) => item.ticker === row.ticker && !item.hidden).length;
    const recent =
      contributionRows.filter((item) => item.ticker === row.ticker && Date.parse(iso(item.created_at)) > weekAgo).length +
      posts;
    return {
      ticker: row.ticker,
      name: row.name,
      tagline: row.description.slice(0, 42),
      description: row.description,
      rules: row.rules,
      membership: row.membership === "collectible" ? "collectible" : "free",
      members,
      treasuryUsdc: usdc,
      treasuryStock: 0,
      weeklyActivity: recent,
      score: 100 + members * 12 + Math.round(usdc / 50) + posts * 4,
      price: "—",
      change: "Base",
      up: true,
      points: [4, 5, 6, 7, 8, 8, 9, 9],
      cover: row.cover,
      founded: day(row.created_at),
      founder: shortAddr(row.founder),
      founderAddress: row.founder,
      split: { members: row.members_split, ops: row.ops_split, founder: row.founder_split },
      stockSymbol: row.stock_symbol,
      stockName: row.stock_name,
      telegram: row.telegram,
      xHandle: row.x_handle,
      discord: row.discord,
      telegramLinked: Boolean(row.telegram_chat),
    };
  });

  const proposals: Proposal[] = proposalRows.map((row) => {
    const votes = voteRows.filter((item) => item.proposal_id === row.id);
    const closes = Date.parse(iso(row.closes_at));
    const daysLeft = Math.max(0, Math.ceil((closes - Date.now()) / 86_400_000));
    return {
      id: row.id,
      ticker: row.ticker,
      title: row.title,
      body: row.body,
      yes: votes.filter((item) => item.choice === "yes").length,
      no: votes.filter((item) => item.choice === "no").length,
      daysLeft,
    };
  });

  const challenges: Challenge[] = challengeRows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    title: row.title,
    detail: row.detail,
    reward: row.reward,
    entries: entryRows.filter((item) => item.challenge_id === row.id).length,
  }));

  const posts: Post[] = postRows
    .filter((row) => !row.hidden)
    .map((row) => ({
      id: row.id,
      ticker: row.ticker,
      author: shortAddr(row.author),
      kind: row.kind === "meme" || row.kind === "research" ? row.kind : "update",
      body: row.body,
      likes: 0,
    }));

  const contributions: Contribution[] = contributionRows.map((row) => ({
    id: row.id,
    ticker: row.ticker,
    address: row.address,
    amount: Number(row.amount),
    at: iso(row.created_at),
  }));

  const members: MemberRow[] = memberRows.map((row) => ({
    ticker: row.ticker,
    address: row.address,
    role: clubs.find((club) => club.ticker === row.ticker)?.founder === row.address ? "Founder" : "Member",
  }));

  const mine = address
    ? {
        joined: memberRows.filter((row) => row.address === address).map((row) => row.ticker),
        minted: memberRows.filter((row) => row.address === address && row.minted).map((row) => row.ticker),
        votes: Object.fromEntries(
          voteRows.filter((row) => row.address === address).map((row) => [row.proposal_id, row.choice === "no" ? "no" : "yes"]),
        ) as Record<string, "yes" | "no">,
        entered: entryRows.filter((row) => row.address === address).map((row) => row.challenge_id),
        cheers: cheerRows.filter((row) => row.address === address).map((row) => row.ticker),
        hidden: postRows.filter((row) => row.hidden && row.author === address).map((row) => row.id),
      }
    : { joined: [], minted: [], votes: {}, entered: [], cheers: [], hidden: [] };

  const points = address
    ? clubs.filter((row) => row.founder === address).length * 50 +
      mine.joined.length * 20 +
      mine.minted.length * 10 +
      Object.keys(mine.votes).length * 15 +
      postRows.filter((row) => row.author === address && !row.hidden).length * 10 +
      challengeRows.filter((row) => row.author === address).length * 25 +
      mine.entered.length * 15 +
      mine.cheers.length * 5 +
      Math.floor(contributionRows.filter((row) => row.address === address).reduce((sum, row) => sum + Number(row.amount), 0) / 10)
    : 0;

  return {
    clubs: mapped,
    proposals,
    challenges,
    posts,
    contributions,
    members,
    registry: CLUB_REGISTRY ?? config[0]?.registry ?? null,
    me: { address, points, ...mine },
  };
}

function cleanSocial(value: unknown): string | null {
  const text = String(value ?? "").trim().slice(0, 120);
  return text.length > 0 ? text : null;
}

async function memberOf(ticker: string, address: string): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ ticker: string }>`select ticker from members where ticker = ${ticker} and address = ${address}`;
  return rows.length > 0;
}

export async function handleWorld(token: string | null, body: Record<string, unknown>): Promise<Result> {
  const action = String(body.action ?? "");
  const sql = await getSql();

  if (action === "nonce") {
    const address = cleanAddress(body.address);
    if (!address) return fail("That is not a wallet address.");
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await sql`
      insert into wallet_nonces (address, nonce, expires_at)
      values (${address}, ${nonce}, ${expires})
      on conflict (address) do update set nonce = ${nonce}, expires_at = ${expires}
    `;
    return { ok: true, nonce, message: signInMessage(getAddress(address), nonce) };
  }

  if (action === "session") {
    const address = cleanAddress(body.address);
    const signature = String(body.signature ?? "");
    if (!address || !signature.startsWith("0x")) return fail("Sign in with your wallet.");
    const rows = await sql<{ nonce: string }>`
      select nonce from wallet_nonces where address = ${address} and expires_at > now()
    `;
    const nonce = rows[0]?.nonce;
    if (!nonce) return fail("Sign-in expired. Try connecting again.");
    const valid = await verifyMessage({
      address: getAddress(address),
      message: signInMessage(getAddress(address), nonce),
      signature: signature as `0x${string}`,
    });
    if (!valid) return fail("Signature did not match this wallet.");
    const session = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sql`delete from wallet_nonces where address = ${address}`;
    await sql`insert into wallet_sessions (token, address, expires_at) values (${session}, ${address}, ${expires})`;
    return { ok: true, token: session };
  }

  const address = await actor(token);
  if (!address) return fail("Connect a wallet first.");

  if (action === "logout") {
    await sql`delete from wallet_sessions where token = ${token}`;
    return { ok: true };
  }

  if (action === "createClub") {
    const ticker = cleanTicker(body.ticker);
    const name = String(body.name ?? "").trim().slice(0, 48);
    const description = String(body.description ?? "").trim().slice(0, 600);
    const rules = (String(body.rules ?? "").trim() || "Be useful. No spam. No fake volume.").slice(0, 600);
    const membership: Membership = body.membership === "collectible" ? "collectible" : "free";
    const members = Number(body.members);
    const ops = Number(body.ops);
    const founder = Number(body.founder);
    const cover = String(body.cover ?? "");
    const stockSymbol = String(body.stockSymbol ?? "").trim().slice(0, 24);
    const stockName = String(body.stockName ?? "").trim().slice(0, 80);
    const telegram = cleanSocial(body.telegram);
    const xHandle = cleanSocial(body.x);
    const discord = cleanSocial(body.discord);
    if (!ticker) return fail("Ticker needs letters.");
    if (!name && !stockName) return fail("Club name is required.");
    const clubName = name || stockName;
    let about = description;
    if (about.length < 12) {
      about = stockSymbol
        ? `Community for ${stockName || stockSymbol} (${stockSymbol}).`
        : about;
    }
    if (about.length < 12) return fail("Describe the club in a sentence, or pick a stock.");
    if (![members, ops, founder].every((n) => Number.isInteger(n) && n >= 0 && n <= 100) || members + ops + founder !== 100) {
      return fail("Revenue split must add up to 100.");
    }
    if (!cover.startsWith("/media/")) return fail("Pick a cover.");
    const existing = await sql<{ ticker: string }>`select ticker from clubs where ticker = ${ticker}`;
    if (existing.length) return fail("That ticker already has a club.");
    await sql`
      insert into clubs (ticker, name, description, rules, membership, founder, cover, members_split, ops_split, founder_split, stock_symbol, stock_name, telegram, x_handle, discord)
      values (${ticker}, ${clubName}, ${about}, ${rules}, ${membership}, ${address}, ${cover}, ${members}, ${ops}, ${founder}, ${stockSymbol || null}, ${stockName || null}, ${telegram}, ${xHandle}, ${discord})
    `;
    await sql`
      insert into members (ticker, address, minted) values (${ticker}, ${address}, ${membership === "collectible"})
    `;
    return { ok: true, ticker };
  }

  if (action === "join" || action === "mint") {
    const ticker = cleanTicker(body.ticker);
    if (!ticker) return fail("Club not found.");
    const clubs = await sql<{ membership: string }>`select membership from clubs where ticker = ${ticker}`;
    const club = clubs[0];
    if (!club) return fail("Club not found.");
    if (await memberOf(ticker, address)) return fail("Already a member.");
    if (action === "join" && club.membership === "collectible") {
      return fail("This club uses a collectible membership. Mint it first.");
    }
    await sql`
      insert into members (ticker, address, minted) values (${ticker}, ${address}, ${action === "mint"})
    `;
    return { ok: true };
  }

  if (action === "contribute") {
    const ticker = cleanTicker(body.ticker);
    const amount = Number(body.amount);
    const txHash = String(body.txHash ?? "").toLowerCase();
    if (!ticker) return fail("Club not found.");
    if (!(await memberOf(ticker, address))) return fail("Join the club before contributing.");
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) return fail("Enter between 1 and 1,000,000 USDC.");
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail("Missing the Base transaction.");
    const config = await sql<{ registry: string | null }>`select registry from chain_config where id = 1`;
    const registry = CLUB_REGISTRY ?? config[0]?.registry;
    if (!registry) return fail("Deploy the treasury contract before sending USDC.");
    const seen = await sql<{ id: string }>`select id from contributions where tx_hash = ${txHash}`;
    if (seen.length) return fail("That transaction is already recorded.");
    const ok = await receiptPays(txHash, address, registry, amount);
    if (!ok) return fail("Base did not show that USDC landing in the treasury.");
    const id = crypto.randomUUID();
    await sql`
      insert into contributions (id, ticker, address, amount, tx_hash)
      values (${id}, ${ticker}, ${address}, ${amount}, ${txHash})
    `;
    return { ok: true };
  }

  if (action === "registry") {
    const txHash = String(body.txHash ?? "").toLowerCase();
    if (!/^0x[0-9a-f]{64}$/.test(txHash)) return fail("Missing the deploy transaction.");
    const current = await sql<{ registry: string | null }>`select registry from chain_config where id = 1`;
    if (CLUB_REGISTRY || current[0]?.registry) return fail("The treasury contract is already on Base Sepolia.");
    const deployed = await receiptDeploys(txHash, address);
    if (!deployed) return fail("That transaction did not deploy the StockClub contract.");
    await sql`update chain_config set registry = ${deployed}, deployer = ${address} where id = 1`;
    return { ok: true };
  }

  if (action === "propose") {
    const ticker = cleanTicker(body.ticker);
    const title = String(body.title ?? "").trim().slice(0, 80);
    const text = String(body.body ?? "").trim().slice(0, 600);
    const days = Number(body.days);
    if (!ticker || !(await memberOf(ticker, address))) return fail("Join the club to propose.");
    if (title.length < 4 || text.length < 8) return fail("A proposal needs a title and a reason.");
    if (!Number.isInteger(days) || days < 1 || days > 14) return fail("Voting stays open between 1 and 14 days.");
    const id = crypto.randomUUID();
    const closes = new Date(Date.now() + days * 86_400_000).toISOString();
    await sql`
      insert into proposals (id, ticker, author, title, body, closes_at)
      values (${id}, ${ticker}, ${address}, ${title}, ${text}, ${closes})
    `;
    return { ok: true };
  }

  if (action === "vote") {
    const id = String(body.id ?? "");
    const choice = body.choice === "no" ? "no" : body.choice === "yes" ? "yes" : "";
    if (!choice) return fail("Vote yes or no.");
    const rows = await sql<{ ticker: string; closes_at: unknown }>`
      select ticker, closes_at from proposals where id = ${id}
    `;
    const proposal = rows[0];
    if (!proposal) return fail("Proposal not found.");
    if (Date.parse(iso(proposal.closes_at)) <= Date.now()) return fail("That vote is closed.");
    if (!(await memberOf(proposal.ticker, address))) return fail("Join the club to vote.");
    const existing = await sql<{ choice: string }>`select choice from votes where proposal_id = ${id} and address = ${address}`;
    if (existing.length) return fail("You already voted on this proposal.");
    await sql`insert into votes (proposal_id, address, choice) values (${id}, ${address}, ${choice})`;
    return { ok: true };
  }

  if (action === "challenge") {
    const ticker = cleanTicker(body.ticker);
    const title = String(body.title ?? "").trim().slice(0, 80);
    const detail = String(body.detail ?? "").trim().slice(0, 400);
    const reward = String(body.reward ?? "").trim().slice(0, 80);
    if (!ticker || !(await memberOf(ticker, address))) return fail("Join the club to post a challenge.");
    if (title.length < 4 || detail.length < 8) return fail("Name the challenge and what done looks like.");
    const id = crypto.randomUUID();
    await sql`
      insert into challenges (id, ticker, author, title, detail, reward)
      values (${id}, ${ticker}, ${address}, ${title}, ${detail}, ${reward || "Club points"})
    `;
    return { ok: true };
  }

  if (action === "enter") {
    const id = String(body.id ?? "");
    const rows = await sql<{ ticker: string }>`select ticker from challenges where id = ${id}`;
    const challenge = rows[0];
    if (!challenge) return fail("Challenge not found.");
    if (!(await memberOf(challenge.ticker, address))) return fail("Join the club to enter.");
    const existing = await sql<{ address: string }>`select address from entries where challenge_id = ${id} and address = ${address}`;
    if (existing.length) return fail("You already entered.");
    await sql`insert into entries (challenge_id, address) values (${id}, ${address})`;
    return { ok: true };
  }

  if (action === "post") {
    const ticker = cleanTicker(body.ticker);
    const kind = body.kind === "meme" || body.kind === "research" ? body.kind : "update";
    const text = String(body.body ?? "").trim().slice(0, 600);
    if (!ticker || !(await memberOf(ticker, address))) return fail("Members only.");
    if (text.length < 4) return fail("Write something first.");
    const id = crypto.randomUUID();
    await sql`insert into posts (id, ticker, author, kind, body) values (${id}, ${ticker}, ${address}, ${kind}, ${text})`;
    return { ok: true };
  }

  if (action === "hide") {
    const id = String(body.id ?? "");
    const rows = await sql<{ ticker: string }>`select ticker from posts where id = ${id} and hidden = false`;
    const post = rows[0];
    if (!post) return fail("Post not found.");
    const clubs = await sql<{ founder: string }>`select founder from clubs where ticker = ${post.ticker}`;
    if (clubs[0]?.founder !== address) return fail("Only the founder can hide a post.");
    await sql`update posts set hidden = true where id = ${id}`;
    return { ok: true };
  }

  if (action === "cheer") {
    const ticker = cleanTicker(body.ticker);
    if (!ticker) return fail("Club not found.");
    const clubs = await sql<{ ticker: string }>`select ticker from clubs where ticker = ${ticker}`;
    if (!clubs.length) return fail("Club not found.");
    const existing = await sql<{ ticker: string }>`select ticker from cheers where ticker = ${ticker} and address = ${address}`;
    if (existing.length) return fail("One cheer per club.");
    await sql`insert into cheers (ticker, address) values (${ticker}, ${address})`;
    return { ok: true };
  }

  return fail("Unknown action.");
}

async function receiptPays(txHash: string, from: string, registry: string, dollars: number): Promise<boolean> {
  const receipt = (await rpc("eth_getTransactionReceipt", [txHash])) as {
    status?: string;
    from?: string;
    to?: string;
    logs?: { address?: string; topics?: string[]; data?: string }[];
  } | null;
  if (!receipt || receipt.status !== "0x1") return false;
  if (receipt.from?.toLowerCase() !== from) return false;
  if (receipt.to?.toLowerCase() !== registry.toLowerCase()) return false;
  const units = BigInt(dollars) * 1_000_000n;
  const sink = `0x${registry.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
  return (receipt.logs ?? []).some((log) => {
    if (log.address?.toLowerCase() !== BASE_USDC.toLowerCase()) return false;
    if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) return false;
    if (log.topics?.[2]?.toLowerCase() !== sink) return false;
    try {
      return BigInt(log.data ?? "0x0") === units;
    } catch {
      return false;
    }
  });
}

async function receiptDeploys(txHash: string, from: string): Promise<string | null> {
  const receipt = (await rpc("eth_getTransactionReceipt", [txHash])) as {
    status?: string;
    from?: string;
    contractAddress?: string;
  } | null;
  if (!receipt || receipt.status !== "0x1" || !receipt.contractAddress) return null;
  if (receipt.from?.toLowerCase() !== from) return null;
  const code = (await rpc("eth_getCode", [receipt.contractAddress, "latest"])) as string;
  if (code.toLowerCase() !== CLUB_DEPLOYED_BYTECODE.toLowerCase()) return null;
  return getAddress(receipt.contractAddress).toLowerCase();
}
