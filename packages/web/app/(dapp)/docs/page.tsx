import { HoloCard } from "@/components/HoloCard";

const NAV = [
  { id: "what-is-polycat", title: "What is Polycat?" },
  { id: "getting-started", title: "Getting started" },
  { id: "buying-and-selling", title: "Buying & selling" },
  { id: "redeeming", title: "Redeeming a win" },
  { id: "assets-and-settlement", title: "Assets & settlement" },
  { id: "bonding-curve", title: "How prices work" },
  { id: "fees", title: "Fees" },
  { id: "token", title: "Token" },
];

/** Stand-in for the connect-wallet button in the real header, so the walkthrough below can
 * point at something without needing a live wallet connection to screenshot. */
function MockConnectButton() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-gray-950">
      Connect Wallet
    </span>
  );
}

/** A small, static stand-in for a real MarketCard (see components/MarketCard.tsx) —
 * same holo-border/art-zone language, simplified and non-interactive, purely to
 * illustrate what a card on the Markets page looks like. */
function MockMarketCard({ asset, pct, color }: { asset: string; pct: number; color: string }) {
  return (
    <HoloCard radius={20} glow={false} innerClassName="p-4">
      <div className="flex items-start gap-3">
        <span
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-gray-950 font-bold text-xs"
          style={{ backgroundColor: color }}
        >
          {asset.slice(0, 4)}
        </span>
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#1b1300] text-gray-200 mb-1">
            5m window
          </span>
          <p className="font-semibold text-sm leading-snug text-gray-100">Up or Down?</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-extrabold ${pct >= 50 ? "text-emerald-400" : "text-rose-400"}`}>{pct}%</p>
          <p className="text-[10px] text-gray-500 -mt-1">chance Up</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
    </HoloCard>
  );
}

function MockTradePanel({ mode }: { mode: "buy" | "sell" | "redeem" }) {
  if (mode === "redeem") {
    return (
      <HoloCard radius={20} glow={false} innerClassName="p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Outcome: Up 🟢</p>
        <p className="text-xs text-gray-400 mb-3">Winning shares: 0.24 ETH</p>
        <span className="block text-center rounded-full bg-accent text-gray-950 text-sm font-semibold py-2">
          Claim bag
        </span>
      </HoloCard>
    );
  }
  return (
    <HoloCard radius={20} glow={false} innerClassName="p-4">
      <div className="flex rounded-full bg-gray-800 p-1 text-xs font-semibold">
        <span className={`flex-1 text-center rounded-full py-1.5 ${mode === "buy" ? "bg-gray-700 text-white" : "text-gray-400"}`}>
          Ape
        </span>
        <span className={`flex-1 text-center rounded-full py-1.5 ${mode === "sell" ? "bg-gray-700 text-white" : "text-gray-400"}`}>
          Exit
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="text-center rounded-lg bg-emerald-950 text-emerald-400 text-xs font-semibold py-2">Up · 63¢</span>
        <span className="text-center rounded-lg bg-gray-800 text-gray-400 text-xs font-semibold py-2">Down · 37¢</span>
      </div>
      <div className="mt-3 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-400">
        {mode === "buy" ? "Amount (ETH)" : "Shares to sell"}
        <p className="text-gray-100 text-sm font-semibold mt-0.5">{mode === "buy" ? "0.10" : "42"}</p>
      </div>
      <span className="mt-3 block text-center rounded-full bg-accent text-gray-950 text-sm font-semibold py-2">
        {mode === "buy" ? "Ape Up" : "Exit Up"}
      </span>
    </HoloCard>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <span className="shrink-0 h-7 w-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-accent">
        {n}
      </span>
      <div>
        <p className="font-semibold text-sm text-gray-100">{title}</p>
        <p className="text-sm text-gray-400 leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}

export default function DocsPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-10">
      <nav className="hidden md:block sticky top-20 self-start">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">On this page</p>
        <ul className="flex flex-col gap-2">
          {NAV.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-sm text-gray-400 hover:text-gray-100 transition-colors">
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="max-w-2xl flex flex-col gap-14">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-2 block">Documentation</span>
          <h1 className="text-3xl font-extrabold text-gray-100 tracking-tight">Polycat Docs</h1>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">
            Everything you need to know to start trading, in plain English — from connecting a wallet for the
            first time to claiming your winnings.
          </p>
        </div>

        <section id="what-is-polycat" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">What is Polycat?</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Polycat is a simple bet: will an asset&apos;s price be up or down five minutes from now? Pick a side,
            and if you&apos;re right, you get paid. It&apos;s not just BTC, ETH, and SOL either — the list of
            tradable assets keeps growing. &quot;Blue chip&quot; tokens are priced using Gate.com, while on-chain
            pairs (starting with CashCat, the first memecoin on Robinhood Chain) are priced using DexScreener.
            Every market covers one asset and one 5-minute window: whatever the price is when the window opens
            becomes the strike, and when the window closes, Down wins if the price fell below it and Up wins if it
            rose above it. As soon as one window settles, the next one opens automatically, so there&apos;s always
            a fresh market waiting for every asset we support. Polycat runs on Robinhood Chain — the public
            Arbitrum-based Layer 2 that Robinhood launched in July 2026 — and every trade uses that chain&apos;s
            native ETH.
          </p>
        </section>

        <section id="getting-started" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Getting started</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            All you need is a crypto wallet (like MetaMask) and a little ETH. No signup, no forms — you&apos;ll be
            trading in under a minute. Here&apos;s the whole loop, start to finish.
          </p>
          <div className="flex flex-col gap-6">
            <Step
              n={1}
              title="Connect your wallet"
              body='Click "Connect Wallet" in the sidebar, pick your wallet from the list, and approve the connection. That&apos;s it — no account to create.'
            />
            <div className="pl-11">
              <MockConnectButton />
            </div>
            <Step
              n={2}
              title="Pick an asset"
              body="Head over to the Markets tab. Each card is a live 5-minute window for one asset, showing the strike price it needs to beat and the current odds of Up."
            />
            <div className="pl-11 grid gap-3 sm:grid-cols-2">
              <MockMarketCard asset="BTC" pct={64} color="#f7931a" />
              <MockMarketCard asset="CASHCAT" pct={41} color="#ff6b9d" />
            </div>
            <Step
              n={3}
              title="Open a market and trade"
              body="Tap a card to see the live price chart against the strike, plus recent trades. Then use the trade panel to buy Up or Down shares — either enter how much ETH you want to spend, or the exact number of shares you're after. It's a single transaction to confirm, since ETH is native, so there's no separate approval step to worry about."
            />
            <div className="pl-11 max-w-xs">
              <MockTradePanel mode="buy" />
            </div>
            <Step
              n={4}
              title="Hold, sell, or redeem"
              body="Change your mind? Sell your shares back into the market any time before the window closes. Once it settles, head back to the market page (or your Portfolio) and redeem — each winning share pays out 1 ETH straight to your wallet. And if the price landed exactly on the strike, don't worry — that's a push, and you'll get a pro-rata refund instead of a win or loss."
            />
          </div>
        </section>

        <section id="buying-and-selling" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Buying & selling</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Every open market has two sides — Up and Down — and you&apos;re free to move in and out of a position
            any time before the window closes.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">Buying shares</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Pick a side (Up or Down), then choose however you&apos;d rather think about it:{" "}
                <strong className="text-gray-300">Send ETH</strong> — spend an exact amount and get however many
                shares it buys — or <strong className="text-gray-300">Exact shares</strong> — tell it how many
                shares you want and it works out the ETH cost for you. One confirmation in your wallet and
                you&apos;re in — no separate approval step, since it&apos;s all native ETH.
              </p>
              <MockTradePanel mode="buy" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">Selling shares</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Selling is just as simple: enter how many of your Up or Down shares you want to sell back to the
                market, then confirm. You can do this any time before the window closes — there&apos;s no lockup
                and no waiting around for a buyer, since every market is its own automated market maker.
              </p>
              <MockTradePanel mode="sell" />
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mt-6">
            Here&apos;s the simple part: every winning share pays out exactly 1 ETH once a market settles. So the
            number of shares you&apos;re holding is exactly your payout if that side wins — and the price you pay
            per share today just reflects the market&apos;s current odds.
          </p>
        </section>

        <section id="redeeming" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Redeeming a win</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Once a window closes, it settles automatically within moments — you don&apos;t need to do anything to
            trigger it. From there:
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">If your side won</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Head to the market page (or your <strong className="text-gray-300">Portfolio</strong>, which lists
                every position you&apos;ve ever held) and hit{" "}
                <strong className="text-gray-300">Claim bag</strong>. Each winning share pays out exactly 1 ETH,
                sent straight to your wallet in a single transaction.
              </p>
              <MockTradePanel mode="redeem" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">If it was a push</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                Every so often the close price lands exactly on the strike, so neither side wins — that&apos;s
                called a push. No harm done: you&apos;ll see a{" "}
                <strong className="text-gray-300">Claim refund</strong> prompt on the market page that returns
                your pro-rata share of the pool. No losses either way.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mt-6">
            No rush, either — there&apos;s no expiry on a claim. A winning or refundable position just sits there
            waiting for you to redeem it, whenever you get around to it.
          </p>
        </section>

        <section id="assets-and-settlement" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Assets & settlement</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Adding a new asset is as simple as searching for it — no code involved. From the admin dashboard, you
            search DexScreener (for Robinhood Chain pairs) or Gate.com&apos;s tradable tokens, and registering one
            is the entire &quot;add a market&quot; step. Everything after that runs itself: a small background
            script keeps every asset&apos;s 5-minute windows ticking on schedule, always starting on a clean
            5-minute mark. The same script settles a window the moment it closes — it reads the asset&apos;s live
            price and submits it on-chain. From there, the outcome is decided mechanically: below the strike is a
            Down win, above is an Up win, and an exact match is a push. No admin judgment calls, no dispute
            windows — just the same rule, applied the same way, every time.
          </p>
        </section>

        <section id="bonding-curve" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">How prices work: the bonding curve</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            There&apos;s no order book here, and no waiting for someone to take the other side of your trade.
            Instead, every market prices itself using a simple formula (a &quot;bonding curve&quot;) that
            reacts instantly to buying and selling. The more Up shares people buy, the more expensive Up gets and
            the cheaper Down gets — and vice versa — so there&apos;s always a price to trade at, even for the very
            first trade in a brand-new window. The &quot;chance&quot; percentage you see on each market is just
            that curve&apos;s live readout of the odds, and it&apos;s completely separate from the strike price,
            which is locked in the moment the window opens and never moves.
          </p>
        </section>

        <section id="fees" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Fees</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Keeping it simple: there&apos;s one flat fee, 1% by default, on every buy and sell — same rate for
            every market, no surprises. You never have to fund or manage liquidity yourself, since each window
            starts out seeded by the protocol, so those fees just go toward keeping the whole thing running.
          </p>
        </section>

        <section id="token" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Token</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            A Polycat utility token is in the works — nothing to buy, connect, or claim yet, and trading today is
            100% ETH, no token required. Once it&apos;s live, the plan is for it to power a few things:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <HoloCard radius={20} glow={false} innerClassName="p-4">
              <p className="text-sm font-semibold text-gray-100">Governance</p>
              <p className="text-sm text-gray-400 leading-relaxed mt-1">
                Voting on protocol parameters — things like the trading fee rate or which new assets get listed.
              </p>
            </HoloCard>
            <HoloCard radius={20} glow={false} innerClassName="p-4">
              <p className="text-sm font-semibold text-gray-100">Fee deductions</p>
              <p className="text-sm text-gray-400 leading-relaxed mt-1">
                Holding or using it toward a trade is planned to knock down the flat trading fee below the default
                rate.
              </p>
            </HoloCard>
            <HoloCard radius={20} glow={false} innerClassName="p-4">
              <p className="text-sm font-semibold text-gray-100">Trader incentives</p>
              <p className="text-sm text-gray-400 leading-relaxed mt-1">
                A rewards pool for active traders, separate from — not funded by — the protocol fees themselves.
              </p>
            </HoloCard>
            <HoloCard radius={20} glow={false} innerClassName="p-4">
              <p className="text-sm font-semibold text-gray-100">Season 1 leaderboard</p>
              <p className="text-sm text-gray-400 leading-relaxed mt-1">
                A first competitive season ranking traders, with token rewards planned for top finishers.
              </p>
            </HoloCard>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed mt-4">
            None of this is live yet — this section gets real specifics (ticker, contract, distribution) once
            there&apos;s something actually shipped to document.
          </p>
        </section>
      </div>
    </div>
  );
}
