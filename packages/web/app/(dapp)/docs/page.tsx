const NAV = [
  { id: "what-is-hoodmarkets", title: "What is HoodMarkets?" },
  { id: "backers", title: "Backers" },
  { id: "getting-started", title: "Getting started" },
  { id: "buying-and-selling", title: "Buying and selling" },
  { id: "creating-a-market", title: "Creating a market" },
  { id: "settlement", title: "Settlement" },
  { id: "bonding-curve", title: "How prices work" },
  { id: "fees", title: "Fees" },
  { id: "categories", title: "Categories" },
  { id: "roadmap", title: "Roadmap" },
  { id: "developer-docs", title: "Developer docs" },
];

/** Stand-in for the connect-wallet button in the real header, so the walkthrough below can
 * point at something without needing a live wallet connection to screenshot. */
function MockConnectButton() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-gray-900">
      Connect Wallet
    </span>
  );
}

function MockMarketCard({ title, category, pct }: { title: string; category: string; pct: number }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 shrink-0 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold text-sm">
          {title.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#15290E] text-gray-200 mb-1">
            {category}
          </span>
          <p className="font-semibold text-sm leading-snug text-gray-100">{title}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-xl font-extrabold ${pct >= 50 ? "text-emerald-400" : "text-rose-400"}`}>{pct}%</p>
          <p className="text-[10px] text-gray-500 -mt-1">chance</p>
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
        <span className="text-center rounded-lg bg-emerald-950 text-emerald-400 text-xs font-semibold py-2">Yes · 63¢</span>
        <span className="text-center rounded-lg bg-gray-800 text-gray-400 text-xs font-semibold py-2">No · 37¢</span>
      </div>
      <div className="mt-3 rounded-lg bg-gray-800 px-3 py-2 text-xs text-gray-400">
        Amount (USDC)
        <p className="text-gray-100 text-sm font-semibold mt-0.5">25.00</p>
      </div>
      <span className="mt-3 block text-center rounded-full bg-accent text-gray-900 text-sm font-semibold py-2">
        Buy Yes
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
          <p className="text-sm text-gray-400 mt-1">How HoodMarkets works, and how to use it — in plain terms.</p>
        </div>

        <section id="what-is-hoodmarkets" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">What is HoodMarkets?</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            HoodMarkets is a permissionless prediction market: anyone can create a yes/no question, anyone can trade
            shares in the outcome, and prices move in real time to reflect the market&apos;s implied probability.
            It&apos;s built on Robinhood Chain — the public Arbitrum-based Layer 2 Robinhood launched in July 2026 —
            making HoodMarkets the first prediction market deployed there.
          </p>
        </section>

        <section id="backers" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Backers</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            HoodMarkets is backed by Umbrella Labs, Alphatoken Capital, and Web3 Ventures.
          </p>
        </section>

        <section id="getting-started" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Getting started</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            You need a crypto wallet (like MetaMask) and a little USDC to trade. Here&apos;s the full loop, start to
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
              title="Browse markets"
              body="Head to the Markets tab. Filter by category, or sort by trending, newest, closing soonest, or most recently resolved. Each card shows the live implied chance of Yes."
            />
            <div className="pl-11 grid gap-3">
              <MockMarketCard title="Will the Fed cut rates this quarter?" category="Economy" pct={28} />
              <MockMarketCard title="Team Alpha wins the championship?" category="Sports" pct={64} />
            </div>
            <Step
              n={3}
              title="Open a market and trade"
              body="Tap a card to see its full price history and detail. Use the trade panel to buy Yes or No shares — either by entering how much USDC to spend, or the exact number of shares you want."
            />
            <div className="pl-11 max-w-xs">
              <MockTradePanel />
            </div>
            <Step
              n={4}
              title="Hold, sell, or redeem"
              body="Sell shares back into the market any time before it closes. If you hold winning shares once a market settles, head to your Portfolio and redeem — each winning share pays out $1."
            />
          </div>
        </section>

        <section id="buying-and-selling" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Buying and selling</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            You can buy by specifying either the USDC amount you want to spend, or the exact number of outcome shares
            you want to end up with — the app solves for the required cost either way. Selling always works in
            shares. Every winning share redeems for exactly $1 of collateral once a market is settled, so the number
            of shares you hold is exactly your potential payout if that outcome wins.
          </p>
        </section>

        <section id="creating-a-market" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Creating a market</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Anyone can create a market from the <span className="text-gray-200 font-medium">Create Market</span>{" "}
            button in the header.
          </p>
          <div className="flex flex-col gap-4">
            <Step n={1} title="Write your question" body='Keep it a clear yes/no question, e.g. "Will X happen by Y date?"' />
            <Step n={2} title="Pick a category and close date" body="This is what people use to find your market, and when trading stops." />
            <Step
              n={3}
              title="Seed initial liquidity"
              body="You provide the USDC that backs the market's starting price curve. You don't get shares for this — it's what lets the very first trader buy or sell. In return, you earn a share of every trading fee collected on your market, withdrawable any time."
            />
          </div>
        </section>

        <section id="settlement" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Settlement</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Markets are settled by an AI agent (an LLM) that determines the outcome once trading closes — a single
            on-chain call sets the final outcome. There&apos;s no bond, no dispute window, and no oracle module. This
            is a deliberate simplicity tradeoff: it keeps the protocol small and fast to reason about, in exchange for
            trusting a single settlement agent rather than a decentralized dispute process.
          </p>
        </section>

        <section id="bonding-curve" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">How prices work: the bonding curve</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Instead of matching buyers with sellers order-book style, every market is its own automated market maker
            using a Pythagorean bonding curve: reserve = c × √(yesSupply² + noSupply²). Buying Yes shares increases
            yesSupply and pulls the price of Yes up (and No down) continuously — there&apos;s always someone to trade
            with, even for the very first trade in a brand-new market. The displayed &quot;chance&quot; percentage is
            exactly yesSupply² / (yesSupply² + noSupply²), independent of trading fees.
          </p>
        </section>

        <section id="fees" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Fees</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            A flat protocol trading fee (1% by default) applies to every buy and sell, set globally by the platform
            admin. It is not configurable per market. 5% of every fee collected goes to that market&apos;s creator
            rather than the protocol treasury — withdrawable any time from the market page — as the only return a
            creator earns on the liquidity they seeded.
          </p>
        </section>

        <section id="categories" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Categories</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Every market can be tagged with a category (Politics, Elections, World, Economy, Business, Crypto,
            Sports, Tech, AI, Science, Space, Climate, Health, Entertainment, Movies, Music, Gaming, Awards, Culture,
            Law, or Other) at creation time, so the markets list can be searched, filtered, and sorted — by category,
            by trending volume, by newest, by soonest-to-close, or by most-recently-resolved.
          </p>
        </section>

        <section id="roadmap" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Roadmap</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            HoodMarkets is early. Here&apos;s where things stand today, and what&apos;s coming next.
          </p>
          <div className="flex flex-col gap-3">
            <RoadmapItem
              status="live"
              title="Trading on Robinhood Chain"
              body="Create markets, trade Yes/No shares, and redeem winnings — live today."
            />
            <RoadmapItem
              status="live"
              title="No token"
              body="There is no HoodMarkets token, and none is being sold or airdropped right now. Trading uses USDC/USDG. Be wary of anyone claiming otherwise."
            />
            <RoadmapItem
              status="next"
              title="Native mobile app"
              body="A dedicated iOS/Android app for browsing and trading markets on the go."
            />
            <RoadmapItem
              status="next"
              title="Multichain support"
              body="Bringing HoodMarkets to additional chains beyond Robinhood Chain, so liquidity isn't locked to one network."
            />
          </div>
        </section>

        <section id="developer-docs" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Developer docs</h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-sm font-semibold text-gray-100">Coming soon</p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">
              Contract addresses, ABI reference, and integration guides for building on top of HoodMarkets are on the
              way.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
