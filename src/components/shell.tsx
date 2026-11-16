import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  Compass,
  Gift,
  House,
  Landmark,
  Menu,
  Scale,
  Search,
  Settings,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { allClubs, shortAddr, tickerFromSymbol } from "@/lib/stockclub/model";
import { searchStocks, type StockHit } from "@/lib/stockclub/market";
import { useStock } from "@/lib/stockclub/store";

const NAV = [
  { to: "/", label: "Home", icon: House },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/clubs", label: "My Clubs", icon: Users },
  { to: "/treasury", label: "Treasury", icon: Landmark },
  { to: "/governance", label: "Governance", icon: Scale },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/rewards", label: "Rewards", icon: Gift },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const wallet = useStock((s) => s.wallet);
  const connectOpen = useStock((s) => s.connectOpen);
  const openConnect = useStock((s) => s.openConnect);
  const closeConnect = useStock((s) => s.closeConnect);
  const connectError = useStock((s) => s.connectError);
  const busy = useStock((s) => s.busy);
  const connect = useStock((s) => s.connect);
  const refresh = useStock((s) => s.refresh);
  const disconnect = useStock((s) => s.disconnect);
  const notice = useStock((s) => s.notice);
  const setNotice = useStock((s) => s.setNotice);
  const query = useStock((s) => s.query);
  const setQuery = useStock((s) => s.setQuery);
  const extras = useStock((s) => s.extras);
  const [menu, setMenu] = useState(false);
  const [gear, setGear] = useState(false);
  const [stocks, setStocks] = useState<StockHit[]>([]);

  useEffect(() => {
    void Promise.resolve(useStock.persist.rehydrate()).then(() => refresh());
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(id);
  }, [notice, setNotice]);

  useEffect(() => {
    setMenu(false);
  }, [path]);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allClubs(extras)
      .filter((club) =>
        `${club.name} ${club.ticker} ${club.tagline} ${club.stockSymbol ?? ""} ${club.stockName ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [extras, query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setStocks([]);
      return;
    }
    const id = window.setTimeout(() => {
      void searchStocks(q).then(setStocks).catch(() => setStocks([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [query]);

  return (
    <div className="shell">
      <aside className={menu ? "sidebar is-open" : "sidebar"}>
        <div className="brand-row">
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 16h3V8H4v8zm6 0h3V4h-3v12zm6 0h3v-6h-3v6z" />
              </svg>
            </span>
            StockClub
          </Link>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setMenu(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <nav className="side-nav">
          {NAV.map((item) => {
            const active = item.to === "/" ? path === "/" : path.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={active ? "nav-link is-active" : "nav-link"}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="side-card">
          <p className="eyebrow">Join the movement</p>
          <p>Your community. Your financial future.</p>
          <Link to="/create" className="btn btn-lime">
            Create a Club <ArrowRight size={16} />
          </Link>
        </div>
        <div className="profile-chip">
          <span className="avatar">{wallet ? wallet.name.slice(0, 1).toUpperCase() : "?"}</span>
          <span className="profile-copy">
            <strong>{wallet ? wallet.name : "Guest"}</strong>
            <small>{wallet ? shortAddr(wallet.address) : "Not connected"}</small>
          </span>
          <button type="button" className="icon-btn" aria-label="Profile" onClick={() => setGear((v) => !v)}>
            <Settings size={16} />
          </button>
          {gear ? (
            <div className="gear-pop">
              {wallet ? (
                <button type="button" onClick={() => { disconnect(); setGear(false); }}>
                  Disconnect
                </button>
              ) : (
                <button type="button" onClick={() => { openConnect(); setGear(false); }}>
                  Connect wallet
                </button>
              )}
            </div>
          ) : null}
        </div>
      </aside>
      {menu ? <button type="button" className="scrim" aria-label="Close menu" onClick={() => setMenu(false)} /> : null}
      <div className="workspace">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu size={18} />
          </button>
          <form
            className="search"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search stocks, clubs, or a ticker..."
              aria-label="Search stocks and clubs"
            />
            {hits.length > 0 || stocks.length > 0 ? (
              <div className="search-pop">
                {hits.map((club) => (
                  <Link
                    key={club.ticker}
                    to="/club/$ticker"
                    params={{ ticker: club.ticker.toLowerCase() }}
                    onClick={() => setQuery("")}
                  >
                    <strong>{club.ticker}</strong>
                    <span>{club.name}</span>
                    <small>Club</small>
                  </Link>
                ))}
                {stocks.map((hit) => {
                  const existing = allClubs(extras).find(
                    (club) => club.stockSymbol?.toUpperCase() === hit.symbol.toUpperCase() || club.ticker === tickerFromSymbol(hit.symbol),
                  );
                  if (existing) {
                    return (
                      <Link
                        key={hit.symbol}
                        to="/club/$ticker"
                        params={{ ticker: existing.ticker.toLowerCase() }}
                        onClick={() => setQuery("")}
                      >
                        <strong>{hit.symbol}</strong>
                        <span>{hit.name}</span>
                        <small>Club</small>
                      </Link>
                    );
                  }
                  const next = `/create?symbol=${encodeURIComponent(hit.symbol)}&name=${encodeURIComponent(hit.name)}&type=${encodeURIComponent(hit.type)}`;
                  return (
                    <a key={hit.symbol} href={next} onClick={() => setQuery("")}>
                      <strong>{hit.symbol}</strong>
                      <span>{hit.name}</span>
                      <small>{hit.type} · Create</small>
                    </a>
                  );
                })}
              </div>
            ) : null}
          </form>
          <div className="top-actions">
            <span className="base-chip">
              <span className="base-dot" /> Sepolia
            </span>
            {wallet ? (
              <button type="button" className="btn btn-white btn-slim" onClick={() => disconnect()}>
                {shortAddr(wallet.address)}
              </button>
            ) : (
              <button type="button" className="btn btn-white btn-slim" onClick={() => openConnect()}>
                Connect Wallet
              </button>
            )}
          </div>
        </header>
        <div className="workspace-scroll">{children}</div>
      </div>
      {connectOpen ? (
        <div className="modal-root" role="presentation" onClick={() => closeConnect()}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <h2 id="connect-title">Connect on Base</h2>
              <button type="button" className="icon-btn" onClick={() => closeConnect()} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              Sign a message with your Base wallet. The signature proves the address. USDC only moves when you confirm a transfer.
            </p>
            {connectError ? <p className="form-error">{connectError}</p> : null}
            <button type="button" className="wallet-option" disabled={busy} onClick={() => void connect("browser")}>
              <span>Browser wallet</span>
              <small>MetaMask or any injected wallet on Base</small>
            </button>
            <button type="button" className="wallet-option" disabled={busy} onClick={() => void connect("coinbase")}>
              <span>Coinbase Wallet</span>
              <small>The Coinbase extension, on Base</small>
            </button>
          </div>
        </div>
      ) : null}
      {notice ? <div className="toast" role="status">{notice}</div> : null}
    </div>
  );
}
