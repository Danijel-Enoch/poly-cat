const NAV = [
  { id: "what-is-polycat", title: "What is Polycat?" },
  { id: "backers", title: "Backers" },
  { id: "getting-started", title: "Getting started" },
  { id: "buying-and-selling", title: "Buying and selling" },
  { id: "assets-and-settlement", title: "Assets & settlement" },
  { id: "bonding-curve", title: "How prices work" },
  { id: "fees", title: "Fees" },
  { id: "roadmap", title: "Roadmap" },
  { id: "developer-docs", title: "Developer docs" },
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

function MockMarketCard({ asset, pct }: { asset: string; pct: number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 shrink-0 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-sm">
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
    </div>
  );
}

function MockTradePanel() {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex rounded-full bg-gray-800 p-1 text-xs font-semibold">
        <span className="flex-1 text-center rounded-full bg-gray-700 py-1.5 text-white">Buy</span>
        <span className="flex-1 text-center py-1.5 text-gray-400">Sell</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <span className="text-center rounded-lg bg-emerald-950 text-emerald-400 text-xs font-semibold py-2">Up · 63¢</span>
        <span className="text-center rounded-lg bg-gray-800 text-gray-400 text-xs font-semibold py-2">Down · 37¢</span>
      </div>
      <div className="mt-3 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-400">
        Amount (ETH)
        <p className="text-gray-100 text-sm font-semibold mt-0.5">0.10</p>
      </div>
      <span className="mt-3 block text-center rounded-full bg-accent text-gray-950 text-sm font-semibold py-2">
        Buy Up
      </span>
    </div>
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

function RoadmapItem({
  status,
  title,
  body,
}: {
  status: "live" | "next" | "later";
  title: string;
  body: string;
}) {
  const badge =
    status === "live"
      ? { label: "Live", className: "bg-emerald-950 text-emerald-400" }
      : status === "next"
        ? { label: "Coming soon", className: "bg-accent/20 text-accent" }
        : { label: "Planned", className: "bg-gray-800 text-gray-400" };

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4 flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-sm text-gray-100">{title}</p>
        <p className="text-sm text-gray-400 leading-relaxed mt-1">{body}</p>
      </div>
      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}>
        {badge.label}
      </span>
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
          <h1 className="text-2xl font-extrabold text-gray-100">Docs</h1>
          <p className="text-sm text-gray-400 mt-1">How Polycat works, and how to use it — in plain terms.</p>
        </div>

        <section id="what-is-polycat" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">What is Polycat?</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Polycat is a fixed 5-minute Up/Down market over a growing list of assets — not just BTC, ETH, and
            SOL. &quot;Blue chip&quot; tokens are priced via Gate.com; on-chain pairs (starting with CashCat, the
            first memecoin on Robinhood Chain) are priced via DexScreener. Every market is scoped to one asset and
            one 5-minute window. The asset&apos;s price at the moment the window opens is the strike; Down wins if
            the price is below the strike when the window closes, Up wins if it&apos;s above. New windows open
            automatically the moment the previous one settles, so there&apos;s always a live market for every
            registered asset. It&apos;s built on Robinhood Chain — the public Arbitrum-based Layer 2 Robinhood
            launched in July 2026 — and trades entirely in that chain&apos;s native ETH.
          </p>
        </section>

        <section id="backers" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Backers</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Polycat is backed by Umbrella Labs, Alphatoken Capital, and Web3 Ventures.
          </p>
        </section>

        <section id="getting-started" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Getting started</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            You need a crypto wallet (like MetaMask) and a little ETH to trade. Here&apos;s the full loop, start to
            finish.
          </p>
          <div className="flex flex-col gap-6">
            <Step
              n={1}
              title="Connect your wallet"
              body='Click "Connect Wallet" in the top right of the app. Approve the connection in your wallet — no signup, no email, no account.'
            />
            <div className="pl-11">
              <MockConnectButton />
            </div>
            <Step
              n={2}
              title="Pick an asset"
              body="Head to the Markets tab. Each card is a live 5-minute window for one registered asset, showing the strike price and the current implied chance of Up."
            />
            <div className="pl-11 grid gap-3">
              <MockMarketCard asset="BTC" pct={64} />
              <MockMarketCard asset="CASHCAT" pct={41} />
            </div>
            <Step
              n={3}
              title="Open a market and trade"
              body="Tap a card to see the live price chart against the strike, plus trade history. Use the trade panel to buy Up or Down shares — either by entering how much ETH to spend, or the exact number of shares you want. Buying is a single transaction — no separate approval step, since ETH is native."
            />
            <div className="pl-11 max-w-xs">
              <MockTradePanel />
            </div>
            <Step
              n={4}
              title="Hold, sell, or redeem"
              body="Sell shares back into the market any time before the window closes. Once it settles, head back to the market page (or your Portfolio) and redeem — each winning share pays out 1 ETH. If the window closed at exactly the strike price, it's a push instead: claim a pro-rata refund rather than a win/loss."
            />
          </div>
        </section>

        <section id="buying-and-selling" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Buying and selling</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            You can buy by specifying either the ETH amount you want to spend, or the exact number of Up/Down
            shares you want to end up with — the app solves for the required cost either way. Selling always works
            in shares. Every winning share redeems for exactly 1 ETH once a market is settled, so the number of
            shares you hold is exactly your potential payout if that side wins.
          </p>
        </section>

        <section id="assets-and-settlement" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Assets & settlement</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            New assets are added from the admin dashboard, not by writing code: search DexScreener (scoped to
            Robinhood Chain pairs) or Gate.com&apos;s tradable tokens, and registering one is the entire &quot;add a
            market&quot; action. From there it&apos;s fully automatic — a small script (see{" "}
            <code className="text-gray-300">packages/cron</code> in the repo) keeps every registered asset&apos;s
            5-minute window running on a schedule, aligned to the clock (a window always starts on a multiple of 5
            minutes since epoch). The same script settles a window the moment it closes: it reads the asset&apos;s
            live price — from Gate.com or DexScreener, whichever it was registered with — and submits it in a single
            transaction. The contract compares that price to the strike recorded when the window opened — below is
            a Down win, above is an Up win, an exact match is a push — and finalizes the outcome immediately.
            There&apos;s no admin judgment call and no dispute window; the rule is mechanical and the same every
            time.
          </p>
        </section>

        <section id="bonding-curve" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">How prices work: the bonding curve</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Instead of matching buyers with sellers order-book style, every market is its own automated market maker
            using a Pythagorean bonding curve: reserve = c × √(upSupply² + downSupply²). Buying Up shares increases
            upSupply and pulls the price of Up up (and Down down) continuously — there&apos;s always someone to
            trade with, even for the very first trade in a brand-new window. The displayed &quot;chance&quot;
            percentage is exactly upSupply² / (upSupply² + downSupply²), independent of trading fees — and separate
            from the strike price itself, which only the recorded start/close price (not the curve) determines.
          </p>
        </section>

        <section id="fees" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Fees</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            A flat protocol trading fee (1% by default) applies to every buy and sell, set globally by the protocol
            owner. It is not configurable per market. Every window is seeded with protocol-owned liquidity rather
            than a user-provided one, so all collected fees go to the protocol treasury.
          </p>
        </section>

        <section id="roadmap" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Roadmap</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Polycat is early. Here&apos;s where things stand today, and what&apos;s coming next.
          </p>
          <div className="flex flex-col gap-3">
            <RoadmapItem
              status="live"
              title="Up/Down trading on Robinhood Chain"
              body="Fixed 5-minute windows over a growing asset list — BTC/ETH/SOL via Gate.com, CashCat (and any future Robinhood Chain memecoin) via DexScreener — opened and settled automatically."
            />
            <RoadmapItem
              status="live"
              title="Admin-added markets"
              body="New assets are added by searching DexScreener or Gate.com from the admin dashboard — no code change or redeploy needed."
            />
            <RoadmapItem
              status="live"
              title="No token"
              body="There is no Polycat token, and none is being sold or airdropped right now. Trading uses native ETH. Be wary of anyone claiming otherwise."
            />
            <RoadmapItem
              status="next"
              title="Native mobile app"
              body="A dedicated iOS/Android app for trading windows on the go."
            />
            <RoadmapItem
              status="next"
              title="More chains"
              body="Sourcing on-chain pairs from beyond Robinhood Chain as more memecoin activity moves there."
            />
          </div>
        </section>

        <section id="developer-docs" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Developer docs</h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm font-semibold text-gray-100">See the repo</p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">
              Contract source and tests live in <code className="text-gray-300">packages/contracts</code>, the
              settlement/creation script in <code className="text-gray-300">packages/cron</code>, and the full
              architecture writeup in the repo&apos;s <code className="text-gray-300">DOCS.md</code>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
