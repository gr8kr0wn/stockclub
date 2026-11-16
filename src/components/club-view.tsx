import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Empty, Mark } from "@/components/bits";
import { TokenNote } from "@/components/market-bits";
import {
  compact,
  findClub,
  membersOf,
  money,
  scoreOf,
  socialHref,
  treasuryOf,
  type Post,
} from "@/lib/stockclub/model";
import { useStock } from "@/lib/stockclub/store";

const TABS = ["Overview", "Feed", "Treasury", "Challenges", "Governance", "Members"] as const;
type Tab = (typeof TABS)[number];

export function ClubView({ ticker }: { ticker: string }) {
  const extras = useStock((s) => s.extras);
  const club = findClub(ticker, extras);
  const [tab, setTab] = useState<Tab>("Overview");
  const bumps = useStock((s) => s.bumps);
  const usdcAdd = useStock((s) => s.usdcAdd);
  const stockAdd = useStock((s) => s.stockAdd);
  const joined = useStock((s) => s.joined);
  const minted = useStock((s) => s.minted);
  const wallet = useStock((s) => s.wallet);
  const join = useStock((s) => s.join);
  const mintAndJoin = useStock((s) => s.mintAndJoin);
  const openConnect = useStock((s) => s.openConnect);
  const contributions = useStock((s) => s.contributions);
  const contribute = useStock((s) => s.contribute);
  const votes = useStock((s) => s.votes);
  const vote = useStock((s) => s.vote);
  const userPosts = useStock((s) => s.posts);
  const proposals = useStock((s) => s.proposals);
  const challenges = useStock((s) => s.challenges);
  const members = useStock((s) => s.members);
  const registry = useStock((s) => s.registry);
  const hidden = useStock((s) => s.hidden);
  const publish = useStock((s) => s.publish);
  const hidePost = useStock((s) => s.hidePost);
  const entered = useStock((s) => s.entered);
  const enterChallenge = useStock((s) => s.enterChallenge);
  const propose = useStock((s) => s.propose);
  const postChallenge = useStock((s) => s.challenge);
  const deploy = useStock((s) => s.deploy);
  const [amount, setAmount] = useState("100");
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<Post["kind"]>("update");
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalBody, setProposalBody] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeDetail, setChallengeDetail] = useState("");
  const [challengeReward, setChallengeReward] = useState("");
  const member = club ? joined.includes(club.ticker) : false;

  const roster = useMemo(() => {
    if (!club) return [];
    return members
      .filter((person) => person.ticker === club.ticker)
      .map((person) => ({ name: person.address.slice(0, 6) + "…" + person.address.slice(-4), role: person.role }));
  }, [club, members]);

  if (!club) {
    return (
      <div className="page">
        <Empty title="No club on that ticker" body="It may not exist yet. Create it and take the mark." />
        <Link to="/create" className="btn btn-lime">
          Create a Club
        </Link>
      </div>
    );
  }

  const founder = wallet?.address === club.founderAddress;
  const needsMint = club.membership === "collectible" && !minted.includes(club.ticker) && !member;
  const membersCount = membersOf(club, bumps);
  const treasury = treasuryOf(club, usdcAdd, stockAdd);
  const posts = userPosts.filter((post) => post.ticker === club.ticker && !hidden.includes(post.id));
  const clubProposals = proposals.filter((item) => item.ticker === club.ticker);
  const clubChallenges = challenges.filter((item) => item.ticker === club.ticker);
  const txs = contributions.filter((row) => row.ticker === club.ticker);
  function gate(action: () => void | Promise<unknown>) {
    if (!wallet) {
      openConnect();
      return;
    }
    void action();
  }

  return (
    <div className="page club-page">
      <header className="club-hero">
        <img src={club.cover} alt="" />
        <div className="club-hero-copy">
          <p className="kicker">
            <span>stockclub.app/club/{club.ticker.toLowerCase()}</span>
          </p>
          <h1>
            <Mark ticker={club.ticker} /> {club.name}
          </h1>
          {club.stockSymbol ? <p className="paired">Paired with {club.stockSymbol}{club.stockName ? ` · ${club.stockName}` : ""}</p> : null}
          <Socials club={club} />
          <p className="lede">{club.description}</p>
          <div className="club-hero-stats">
            <span><b>{compact(membersCount)}</b> members</span>
            <span><b>{money(treasury.total)}</b> treasury</span>
            <span><b>{scoreOf(club, bumps, usdcAdd).toLocaleString("en-US")}</b> score</span>
            <span><b>{club.membership === "free" ? "Free" : "Collectible"}</b> membership</span>
          </div>
          {member ? (
            <span className="pill pill-lime">Member{founder ? " · Admin" : ""}</span>
          ) : (
            <button
              type="button"
              className="btn btn-lime"
              onClick={() => gate(() => (needsMint ? mintAndJoin(club.ticker) : join(club.ticker)))}
            >
              {needsMint ? "Mint membership" : "Join Club"}
            </button>
          )}
        </div>
      </header>

      <StockField symbol={club.stockSymbol} ticker={club.ticker} linked={club.telegramLinked} founder={founder} />

      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "is-active" : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Overview" ? (
        <div className="two">
          <article className="panel">
            <h2>Club rules</h2>
            <p>{club.rules}</p>
            <h2>Revenue split</h2>
            <div className="split-meters">
              <SplitMeter label="Members" value={club.split.members} />
              <SplitMeter label="Club ops" value={club.split.ops} />
              <SplitMeter label="Founder" value={club.split.founder} />
            </div>
          </article>
          <article className="panel">
            <h2>This week</h2>
            <p className="stat-inline">{club.weeklyActivity + (member ? 1 : 0)} meaningful actions</p>
            <p className="muted">
              Founded {club.founded} by {club.founder}. The club is the product — the ticker is the identity.
            </p>
          </article>
        </div>
      ) : null}

      {tab === "Feed" ? (
        <div className="stack">
          <form
            className="panel composer"
            onSubmit={(event) => {
              event.preventDefault();
              gate(async () => {
                const result = await publish(club.ticker, kind, draft);
                if (result.ok) setDraft("");
              });
            }}
          >
            <div className="seg">
              {(["update", "research", "meme"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={kind === item ? "is-active" : undefined}
                  onClick={() => setKind(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={member ? "Share a meme, a note, or an update." : "Join to post."}
              rows={3}
            />
            <button type="submit" className="btn btn-lime btn-slim">
              Publish
            </button>
          </form>
          {posts.length === 0 ? <Empty title="Quiet floor" body="Be the first post on this ticker." /> : null}
          {posts.map((post) => (
            <article key={post.id} className="panel post">
              <header>
                <strong>{post.author}</strong>
                <span className="pill">{post.kind}</span>
                {founder ? (
                  <button type="button" className="text-link" onClick={() => hidePost(post.id)}>
                    Hide
                  </button>
                ) : null}
              </header>
              <p>{post.body}</p>
              <small className="muted">{post.likes} likes</small>
            </article>
          ))}
        </div>
      ) : null}

      {tab === "Treasury" ? (
        <div className="stack">
          <article className="panel">
            <h2>{club.name} treasury</h2>
            <p className="fine">
              {registry
                ? "USDC is Base USDC. You approve it, then it is pulled into the club contract. A vote does not buy a stock."
                : "The treasury contract is not on Base yet. Deploy it before any USDC can move. A vote does not buy a stock."}
            </p>
            <div className="stat-row">
              <div>
                <strong>{money(treasury.usdc)}</strong>
                <span>USDC</span>
              </div>
              <div>
                <strong>{money(treasury.stock)}</strong>
                <span>Allocated {club.ticker}</span>
                <TokenNote ticker={club.ticker} />
              </div>
              <div>
                <strong>{money(treasury.total)}</strong>
                <span>Total</span>
              </div>
            </div>
          </article>
          <form
            className="panel row-form"
            onSubmit={(event) => {
              event.preventDefault();
              gate(() => contribute(club.ticker, Number(amount)));
            }}
          >
            <label>
              Contribute USDC
              <input
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))}
              />
            </label>
            <button type="submit" className="btn btn-lime">
              {registry ? "Send USDC" : "Treasury not deployed"}
            </button>
          </form>
          {registry ? (
            <p className="muted">
              Contract{" "}
              <a href={`${"https://sepolia.basescan.org"}/address/${registry}`} target="_blank" rel="noreferrer">
                {registry}
              </a>
            </p>
          ) : (
            <button type="button" className="btn btn-white" onClick={() => gate(() => deploy())}>
              Deploy treasury on Base Sepolia
            </button>
          )}
          <article className="panel">
            <h2>Transactions</h2>
            {txs.length === 0 ? <p className="muted">No confirmed USDC deposits yet.</p> : null}
            <ul className="tx-list">
              {txs.map((row) => (
                <li key={row.id}>
                  <span>USDC in</span>
                  <b>{money(row.amount)}</b>
                  <small>{new Date(row.at).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}

      {tab === "Challenges" ? (
        <div className="featured-grid">
          <form
            className="panel form"
            onSubmit={(event) => {
              event.preventDefault();
              gate(async () => {
                const result = await postChallenge(club.ticker, challengeTitle, challengeDetail, challengeReward);
                if (result.ok) {
                  setChallengeTitle("");
                  setChallengeDetail("");
                  setChallengeReward("");
                }
              });
            }}
          >
            <h2>New challenge</h2>
            <label>
              Title
              <input value={challengeTitle} onChange={(event) => setChallengeTitle(event.target.value)} placeholder="Ship one sourced note" />
            </label>
            <label>
              What done looks like
              <textarea value={challengeDetail} onChange={(event) => setChallengeDetail(event.target.value)} rows={3} />
            </label>
            <label>
              Reward
              <input value={challengeReward} onChange={(event) => setChallengeReward(event.target.value)} placeholder="Club points" />
            </label>
            <button type="submit" className="btn btn-lime btn-slim">Post challenge</button>
          </form>
          {clubChallenges.length === 0 ? (
            <Empty title="No challenges" body="Members can post one. Nothing is preloaded." />
          ) : null}
          {clubChallenges.map((challenge) => {
            const done = entered.includes(challenge.id);
            return (
              <article key={challenge.id} className="panel challenge">
                <h2>{challenge.title}</h2>
                <p>{challenge.detail}</p>
                <p className="muted">{challenge.reward}</p>
                <strong>{challenge.entries} entries</strong>
                <button
                  type="button"
                  className="btn btn-white"
                  disabled={done}
                  onClick={() => gate(() => enterChallenge(challenge.id, club.ticker))}
                >
                  {done ? "Entered" : "Enter"}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "Governance" ? (
        <div className="stack">
          <form
            className="panel form"
            onSubmit={(event) => {
              event.preventDefault();
              gate(async () => {
                const result = await propose(club.ticker, proposalTitle, proposalBody, 3);
                if (result.ok) {
                  setProposalTitle("");
                  setProposalBody("");
                }
              });
            }}
          >
            <h2>New proposal</h2>
            <label>
              Title
              <input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} placeholder="Hold the USDC" />
            </label>
            <label>
              Reason
              <textarea value={proposalBody} onChange={(event) => setProposalBody(event.target.value)} rows={3} />
            </label>
            <button type="submit" className="btn btn-lime btn-slim">Open a 3-day vote</button>
          </form>
          {clubProposals.length === 0 ? (
            <Empty title="No open proposals" body="Members can put a treasury intent to a vote. A yes does not buy an asset." />
          ) : null}
          {clubProposals.map((proposal) => {
            const choice = votes[proposal.id];
            const yes = proposal.yes;
            const no = proposal.no;
            const total = yes + no;
            return (
              <article key={proposal.id} className="panel">
                <p className="kicker">
                  <span>Proposal {proposal.id}</span>
                </p>
                <h2>{proposal.title}</h2>
                <p>{proposal.body}</p>
                <div className="vote-bar" aria-hidden="true">
                  <i style={{ width: `${total ? (yes / total) * 100 : 50}%` }} />
                </div>
                <div className="vote-meta">
                  <span>Yes {yes}</span>
                  <span>No {no}</span>
                  <span>{proposal.daysLeft} days left</span>
                </div>
                <div className="hero-actions">
                  <button type="button" className="btn btn-lime btn-slim" disabled={Boolean(choice)} onClick={() => gate(() => vote(proposal.id, "yes"))}>
                    {choice === "yes" ? "Voted yes" : "Yes"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-slim" disabled={Boolean(choice)} onClick={() => gate(() => vote(proposal.id, "no"))}>
                    {choice === "no" ? "Voted no" : "No"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tab === "Members" ? (
        <ul className="member-list panel">
          {roster.map((person) => (
            <li key={`${person.role}-${person.name}`}>
              <span className="avatar">{person.name.slice(0, 1).toUpperCase()}</span>
              <strong>{person.name}</strong>
              <span className="pill">{person.role}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SplitMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <b>{value}%</b>
      </div>
      <div className="meter-track">
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Socials({ club }: { club: NonNullable<ReturnType<typeof findClub>> }) {
  const links = [
    ["Telegram", socialHref("telegram", club.telegram)],
    ["X", socialHref("x", club.xHandle)],
    ["Discord", socialHref("discord", club.discord)],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (links.length === 0) return null;
  return (
    <p className="socials">
      {links.map(([label, href]) => (
        <a key={label} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      ))}
    </p>
  );
}

function StockField({ symbol, ticker, linked, founder }: { symbol: string | null; ticker: string; linked: boolean; founder: boolean }) {
  const requestCode = useStock((s) => s.telegramCode);
  const [desk, setDesk] = useState<{
    price: string | null;
    change: string | null;
    loss: boolean;
    up: boolean | null;
    news: { id: string; title: string; publisher: string; link: string }[];
    telegram: "off" | "waiting" | "linked";
  } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    const prefix = window.location.pathname.match(/^\/hds-[a-z0-9]+-\d+-[a-z0-9]+/i)?.[0] ?? "";
    const url = `${prefix}/api/news?symbol=${encodeURIComponent(symbol)}&ticker=${encodeURIComponent(ticker)}`;
    let cancel = false;
    void fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (!cancel) setDesk(data);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [symbol, ticker]);

  return (
    <section className="panel stock-field">
      <header className="section-head">
        <h2>{symbol ? `${symbol} field` : "Stock field"}</h2>
        {desk?.price ? (
          <strong className={desk.loss ? "down" : "up"}>
            {desk.loss ? "Loss" : "Gain"} {desk.price} {desk.change}
          </strong>
        ) : null}
      </header>
      {!symbol ? <p className="muted">Pair this club with a stock to see its move and news here.</p> : null}
      {symbol && !desk ? <p className="muted">Loading the move and the news.</p> : null}
      {desk && symbol && !desk.price && desk.news.length === 0 ? <p className="muted">No quote or news for {symbol} right now.</p> : null}
      {desk && desk.news.length > 0 ? (
        <ul className="news-list">
          {desk.news.map((item) => (
            <li key={item.id}>
              <a href={item.link} target="_blank" rel="noreferrer">
                {item.title}
              </a>
              <small>{item.publisher}</small>
            </li>
          ))}
        </ul>
      ) : null}
      {linked || desk?.telegram === "linked" ? (
        <p className="muted">New headlines are pushed to the Telegram group on their own, every 5 minutes. A gain and a loss both go.</p>
      ) : founder ? (
        <div className="telegram-lock">
          <p className="muted">Only you, the club creator, can connect a Telegram group. Get a code, send it to the bot, then add the bot to the group. The code lasts 10 minutes.</p>
          <button
            type="button"
            className="btn btn-lime btn-slim"
            onClick={() => {
              void requestCode(ticker).then((result) => {
                if (!result.ok || !result.code) {
                  setCodeError(result.ok ? "No code came back." : result.reason);
                  return;
                }
                setCode(result.code);
                setBotUrl(result.message || null);
                setCodeError(null);
              });
            }}
          >
            Get Telegram code
          </button>
          {code ? <p className="link-code">{code}</p> : null}
          {botUrl ? (
            <a className="text-link" href={botUrl} target="_blank" rel="noreferrer">
              Open the bot and send this code
            </a>
          ) : code ? (
            <p className="muted">Message the bot and send this code. It will ask if you open it without the code.</p>
          ) : null}
          {codeError ? <p className="form-error">{codeError}</p> : null}
        </div>
      ) : (
        <p className="muted">Only the club creator can connect a Telegram group.</p>
      )}
    </section>
  );
}
