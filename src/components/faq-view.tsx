import { Link } from "@tanstack/react-router";
import { useState } from "react";

const TOPICS = [
  {
    id: "wallet",
    title: "Add your account",
    body: [
      "Open the app and press Connect wallet. Pick the browser wallet or Coinbase.",
      "Approve the connection, then sign the message. That sign-in is your account. It does not spend USDC.",
      "The short address in the corner is the account the club will know you by. Use the same wallet when you deposit or vote.",
    ],
  },
  {
    id: "create",
    title: "Create a club",
    body: [
      "Connect a wallet first, then open Create.",
      "Search the stock, ETF, or index and pair it. Set the club name, a ticker of up to 5 letters, and a one-line description.",
      "Choose free join, or a collectible pass. Set the split so members, ops, and founder add up to 100. An ops wallet is optional. If you leave it empty, the founder receives the ops share.",
      "Add Telegram, X, and Discord if you want them on the club page. Upload a cover or pick one.",
      "Submit. The wallet asks you to register the club on Base. You become the founding member.",
    ],
  },
  {
    id: "join",
    title: "Join a club",
    body: [
      "Open the club and press Join. A free club adds you right away.",
      "A collectible club asks the wallet to confirm mint. That is one transaction. It costs a little Base Sepolia gas, not USDC. There is no picture and nothing to resell. It only marks your address as a member.",
      "If you joined before the current treasury, open the club and press Register on Base so your vote counts.",
    ],
  },
  {
    id: "deposit",
    title: "Deposit into the treasury",
    body: [
      "Open that club and go to the Treasury tab. Each club has its own pot. A deposit to one ticker never shows up in another.",
      "Enter a whole number of USDC and press Send USDC.",
      "The wallet asks twice. First it approves the club contract to take that USDC. Then it sends the deposit.",
      "When it lands, the treasury total goes up and the deposit is listed under Transactions.",
    ],
  },
  {
    id: "payout",
    title: "Request a payout",
    body: [
      "You have to be a member. Open the club and use the payout form.",
      "Enter how much USDC should move. Leave the wallet empty to split it by the club percentages. Fill in a wallet to send the whole amount to that one address.",
      "Add a title so members know what the money is for, then open the vote. It stays open for 3 days. Nothing moves while it is open.",
      "More than half the members have to vote, and yes has to beat no. After the 3 days, anyone can press Release.",
      "A directed payout sends the full amount to that wallet. A split pays ops and the founder immediately. Members press Claim my share for their part.",
      "The treasury number drops by the amount that was released. A vote does not buy the stock.",
    ],
  },
  {
    id: "telegram",
    title: "Add the Telegram group",
    body: [
      "Only the person who created the club can do this. Open the club and press Get Telegram code.",
      "The code lasts 10 minutes. Send it to the bot. If it expires before you verify, request a new one.",
      "After the bot accepts the code, add that bot to your Telegram group. News for the club's stock is posted there. A group added by someone else is left.",
    ],
  },
] as const;

export function FaqView() {
  const [active, setActive] = useState<(typeof TOPICS)[number]["id"]>("wallet");
  const topic = TOPICS.find((item) => item.id === active) ?? TOPICS[0];

  return (
    <div className="page">
      <header className="page-intro">
        <h1>How StockClub works</h1>
        <p>Pick a topic. These are the steps the site actually asks for.</p>
      </header>
      <div className="faq-layout">
        <nav className="faq-nav" aria-label="Help topics">
          {TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === topic.id ? "is-active" : ""}
              onClick={() => setActive(item.id)}
            >
              {item.title}
            </button>
          ))}
        </nav>
        <article className="panel faq-answer">
          <h2>{topic.title}</h2>
          <ol>
            {topic.body.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {topic.id === "create" ? (
            <Link to="/create" className="btn btn-lime btn-slim">
              Create a club
            </Link>
          ) : null}
          {topic.id === "wallet" ? (
            <Link to="/home" className="btn btn-lime btn-slim">
              Open the app
            </Link>
          ) : null}
        </article>
      </div>
    </div>
  );
}
