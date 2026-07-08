import { HoloCard } from "@/components/HoloCard";

const NAV = [
  { id: "what-is-polycat", title: "What is Polycat?" },
  { id: "getting-started", title: "Getting started" },
  { id: "buying-and-selling", title: "Buying & selling" },
  { id: "redeeming", title: "Redeeming a win" },
  { id: "assets-and-settlement", title: "Assets & settlement" },
  { id: "bonding-curve", title: "How prices work" },
  { id: "fees", title: "Fees" },
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
            A complete, plain-language guide to how Polycat works — from connecting a wallet to redeeming a
            settled market.
          </p>
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
              body='Click "Connect Wallet" in the sidebar. Pick a wallet from the list and approve the connection — no signup, no email, no account.'
            />
            <div className="pl-11">
              <MockConnectButton />
            </div>
            <Step
              n={2}
              title="Pick an asset"
              body="Head to the Markets tab. Each card is a live 5-minute window for one registered asset, showing the strike price and the current implied chance of Up."
            />
            <div className="pl-11 grid gap-3 sm:grid-cols-2">
              <MockMarketCard asset="BTC" pct={64} color="#f7931a" />
              <MockMarketCard asset="CASHCAT" pct={41} color="#ff6b9d" />
            </div>
            <Step
              n={3}
              title="Open a market and trade"
              body="Tap a card to see the live price chart against the strike, plus trade history. Use the trade panel to buy Up or Down shares — either by entering how much ETH to spend, or the exact number of shares you want. Buying is a single transaction — no separate approval step, since ETH is native."
            />
            <div className="pl-11 max-w-xs">
              <MockTradePanel mode="buy" />
            </div>
            <Step
              n={4}
              title="Hold, sell, or redeem"
              body="Sell shares back into the market any time before the window closes. Once it settles, head back to the market page (or your Portfolio) and redeem — each winning share pays out 1 ETH. If the window closed at exactly the strike price, it's a push instead: claim a pro-rata refund rather than a win/loss."
            />
          </div>
        </section>

        <section id="buying-and-selling" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Buying & selling</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Every open market has two sides — Up and Down. You can move in and out of a position at any point
            before the window closes.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">Buying shares</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Pick a side (Up or Down), then choose either mode: <strong className="text-gray-300">Send ETH</strong>{" "}
                — spend an exact ETH amount and receive however many shares it buys — or{" "}
                <strong className="text-gray-300">Exact shares</strong> — target a specific number of shares and the
                app solves for the ETH cost. Confirm once in your wallet; there&apos;s no separate approval
                transaction since trading uses native ETH directly.
              </p>
              <MockTradePanel mode="buy" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">Selling shares</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Selling always works in shares: enter how many of your Up or Down shares to sell back into the
                market, and confirm. You can sell any time before the window closes — there&apos;s no lockup and no
                need to wait for a counterparty, since every market is its own automated bonding-curve market
                maker.
              </p>
              <MockTradePanel mode="sell" />
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mt-6">
            Every winning share redeems for exactly 1 ETH once a market settles, so the number of shares you hold
            is exactly your potential payout if that side wins — the price you pay per share today is simply the
            market&apos;s current implied probability.
          </p>
        </section>

        <section id="redeeming" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Redeeming a win</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Once a window closes, the cron script settles it automatically within moments — no action needed on
            your part to trigger settlement. From there:
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">If your side won</p>
              <p className="text-sm text-gray-400 leading-relaxed mb-3">
                Open the market page (or your <strong className="text-gray-300">Portfolio</strong>, which lists
                every position you&apos;ve ever held) and hit{" "}
                <strong className="text-gray-300">Claim bag</strong>. Each winning share pays out exactly 1 ETH,
                sent straight to your wallet in a single transaction.
              </p>
              <MockTradePanel mode="redeem" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-100 mb-1">If it was a push</p>
              <p className="text-sm text-gray-400 leading-relaxed">
                If the close price matched the strike exactly, neither side wins — that&apos;s a push. Instead of
                redeeming, you&apos;ll see a <strong className="text-gray-300">Claim refund</strong> prompt on the
                market page: it returns your pro-rata share of the pool, no losses either way.
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mt-6">
            There&apos;s no expiry on a claim — a winning or refundable position sits there until you redeem it,
            whenever that is.
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

        <section id="developer-docs" className="scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-100 mb-2">Developer docs</h2>
          <HoloCard radius={20} glow={false} innerClassName="p-5">
            <p className="text-sm font-semibold text-gray-100">See the repo</p>
            <p className="text-sm text-gray-400 leading-relaxed mt-1">
              Contract source and tests live in <code className="text-gray-300">packages/contracts</code>, the
              settlement/creation script in <code className="text-gray-300">packages/cron</code>, and the full
              architecture writeup in the repo&apos;s <code className="text-gray-300">DOCS.md</code>.
            </p>
          </HoloCard>
        </section>
      </div>
    </div>
  );
}
