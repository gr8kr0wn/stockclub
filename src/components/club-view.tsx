import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Empty, Mark } from "@/components/bits";
import { TokenNote } from "@/components/market-bits";
import {
  compact,
  findClub,
  membersOf,
  money,
  scoreOf,
  treasuryOf,
  type Post,
  type Proposal,
  type Challenge,
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
  const hidden = useStock((s) => s.hidden);
  const publish = useStock((s) => s.publish);
  const hidePost = useStock((s) => s.hidePost);
  const entered = useStock((s) => s.entered);
  const enterChallenge = useStock((s) => s.enterChallenge);
  const [amount, setAmount] = useState("100");
  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<Post["kind"]>("update");
  const member = club ? joined.includes(club.ticker) : false;

  const roster = useMemo(() => {
    if (!club) return [];
    const list = [{ name: club.founder, role: "Founder" }];
    if (member && wallet && wallet.name !== club.founder) {
      list.push({ name: wallet.name, role: "You" });
    }
    return list;
  }, [club, member, wallet]);

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

  const founder = wallet?.name === club.founder;
  const needsMint = club.membership === "collectible" && !minted.includes(club.ticker) && !member;
  const members = membersOf(club, bumps);
  const treasury = treasuryOf(club, usdcAdd, stockAdd);
  const posts = userPosts.filter((post) => post.ticker === club.ticker && !hidden.includes(post.id));
  const proposals: Proposal[] = [];
  const challenges: Challenge[] = [];
  const txs = contributions.filter((row) => row.ticker === club.ticker);
  function gate(action: () => void) {
    if (!wallet) {
      openConnect();
      return;
    }
    action();
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
          <p className="lede">{club.description}</p>
          <div className="club-hero-stats">
            <span><b>{compact(members)}</b> members</span>
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
              gate(() => {
                const result = publish(club.ticker, kind, draft);
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
            <p className="fine">Simulated USDC and stock allocation. No real funds. A vote does not buy an asset.</p>
            <div className="stat-row">
              <div>
                <strong>{money(treasury.usdc)}</strong>
                <span>USDC</span>
              </div>
              <div>
                <strong>{money(treasury.stock)}</strong>
                <span>Simulated {club.ticker}</span>
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
              Add to treasury
            </button>
          </form>
          <article className="panel">
            <h2>Transactions</h2>
            {txs.length === 0 ? <p className="muted">No contributions from this session yet.</p> : null}
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
          {challenges.length === 0 ? (
            <Empty title="No challenges" body="Nothing is scheduled. Challenges are not preloaded." />
          ) : null}
          {challenges.map((challenge) => {
            const done = entered.includes(challenge.id);
            return (
              <article key={challenge.id} className="panel challenge">
                <h2>{challenge.title}</h2>
                <p>{challenge.detail}</p>
                <p className="muted">{challenge.reward}</p>
                <strong>{challenge.entries + (done ? 1 : 0)} entries</strong>
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
          {proposals.length === 0 ? (
            <Empty title="No open proposals" body="Admins and eligible members can put treasury intent to a vote." />
          ) : null}
          {proposals.map((proposal) => {
            const choice = votes[proposal.id];
            const yes = proposal.yes + (choice === "yes" ? 1 : 0);
            const no = proposal.no + (choice === "no" ? 1 : 0);
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
