const SECTIONS = [
  {
    id: "what-is-hoodmarkets",
    title: "What is HoodMarkets?",
    body: "HoodMarkets is a permissionless prediction market: anyone can create a yes/no question, anyone can trade shares in the outcome, and prices move in real time to reflect the market's implied probability. It's built on Robinhood Chain — the public Arbitrum-based Layer 2 Robinhood launched in July 2026 — making HoodMarkets the first prediction market deployed there.",
  },
  {
    id: "bonding-curve",
    title: "How prices work: the bonding curve",
    body: "Instead of matching buyers with sellers order-book style, every market is its own automated market maker using a Pythagorean bonding curve: reserve = c × √(yesSupply² + noSupply²). Buying Yes shares increases yesSupply and pulls the price of Yes up (and No down) continuously — there's always someone to trade with, even for the very first trade in a brand-new market. The displayed \"chance\" percentage is exactly yesSupply² / (yesSupply² + noSupply²), independent of trading fees.",
  },
  {
    id: "buying-and-selling",
    title: "Buying and selling",
    body: "You can buy by specifying either the USDC amount you want to spend, or the exact number of outcome shares you want to end up with — the app solves for the required cost either way. Selling always works in shares. Every winning share redeems for exactly $1 of collateral once a market is settled, so the number of shares you hold is exactly your potential payout if that outcome wins.",
  },
  {
    id: "settlement",
    title: "Settlement",
    body: "Markets are settled directly by the platform admin once trading closes — a single on-chain call sets the final outcome. There's no bond, no dispute window, and no oracle module. This is a deliberate simplicity tradeoff: it keeps the protocol small and fast to reason about, in exchange for trusting a single admin key rather than a decentralized dispute process.",
  },
  {
    id: "categories",
    title: "Categories",
    body: "Every market can be tagged with a category (Politics, Crypto, Sports, Culture, or Other) at creation time, so the markets list can be searched, filtered, and sorted — by category, by trending volume, by newest, by soonest-to-close, or by most-recently-resolved.",
  },
  {
    id: "fees",
    title: "Fees",
    body: "A flat protocol trading fee (1% by default) applies to every buy and sell, set globally by the platform admin. It is not configurable per market.",
  },
];

export default function DocsPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-10">
      <nav className="hidden md:block sticky top-20 self-start">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">On this page</p>
        <ul className="flex flex-col gap-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-sm text-gray-400 hover:text-gray-100 transition-colors">
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="max-w-2xl flex flex-col gap-10">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-100">Docs</h1>
          <p className="text-sm text-gray-400 mt-1">How HoodMarkets works, in plain terms.</p>
        </div>

        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-lg font-bold text-gray-100 mb-2">{section.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
