const SECTIONS = [
  {
    title: "What is HoodMarkets?",
    body: "HoodMarkets is a permissionless prediction market: anyone can create a yes/no question, anyone can trade shares in the outcome, and prices move in real time to reflect the market's implied probability. It's built on Robinhood Chain — the public Arbitrum-based Layer 2 Robinhood launched in July 2026 — making HoodMarkets the first prediction market deployed there.",
  },
  {
    title: "How prices work: the bonding curve",
    body: "Instead of matching buyers with sellers order-book style, every market is its own automated market maker using a Pythagorean bonding curve: reserve = c × √(yesSupply² + noSupply²). Buying Yes shares increases yesSupply and pulls the price of Yes up (and No down) continuously — there's always someone to trade with, even for the very first trade in a brand-new market. The displayed \"chance\" percentage is exactly yesSupply² / (yesSupply² + noSupply²), independent of trading fees.",
  },
  {
    title: "Buying and selling",
    body: "You can buy by specifying either the USDC amount you want to spend, or the exact number of outcome shares you want to end up with — the app solves for the required cost either way. Selling always works in shares. Every winning share redeems for exactly $1 of collateral once a market is settled, so the number of shares you hold is exactly your potential payout if that outcome wins.",
  },
  {
    title: "Settlement",
    body: "Markets are settled directly by the platform admin once trading closes — a single on-chain call sets the final outcome. There's no bond, no dispute window, and no oracle module. This is a deliberate simplicity tradeoff: it keeps the protocol small and fast to reason about, in exchange for trusting a single admin key rather than a decentralized dispute process.",
  },
  {
    title: "Categories",
    body: "Every market can be tagged with a category (Politics, Crypto, Sports, Culture, or Other) at creation time, so the markets list can be searched, filtered, and sorted — by category, by trending volume, by newest, by soonest-to-close, or by most-recently-resolved.",
  },
  {
    title: "Fees",
    body: "A flat protocol trading fee (1% by default) applies to every buy and sell, set globally by the platform admin. It is not configurable per market.",
  },
];

export default function DocsPage() {
  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Docs</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">How HoodMarkets works, in plain terms.</p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{section.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{section.body}</p>
        </div>
      ))}
    </div>
  );
}
