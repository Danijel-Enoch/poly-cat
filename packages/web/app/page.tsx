import Link from "next/link";
import { Logo } from "@/components/Logo";

function IconCurve() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 15c2.5 0 2.5-6 5-6s2.5 8 5 8 2.5-10 5-10 2.5 6 3 6" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 3 5 13.5h5.5L11 21l8-11h-5.5L13 3Z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5 11 15l4.5-5.5" />
    </svg>
  );
}

function IconNoToken() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 6.5l11 11" />
    </svg>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-left">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-accent">
        {icon}
      </span>
      <p className="font-semibold text-gray-100 mt-3">{title}</p>
      <p className="text-sm text-gray-400 leading-relaxed mt-1.5">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4 text-left">
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

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-5xl w-full mx-auto px-6 pt-6">
        <header className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={36} className="h-9 w-auto" />
            <span className="font-semibold tracking-tight text-lg">Polycat</span>
          </div>
          <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-white">
            Docs
          </Link>
        </header>
      </div>

      <main className="flex-1 flex flex-col items-center px-6">
        <div className="flex flex-col items-center text-center pt-20 pb-16">
          <span className="text-xs font-semibold uppercase tracking-wide text-accent mb-4">Built on Robinhood Chain</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-2xl">
            Pounce on Up or Down. Every 5 minutes.
          </h1>
          <p className="text-gray-400 max-w-xl mt-5 text-base sm:text-lg">
            Pick an asset — blue chips like BTC, ETH, and SOL, or Robinhood Chain memecoins — and buy Up or Down
            before its fixed 5-minute window closes. Down wins if the price drops below where it started, Up wins if
            it&apos;s higher. Trade with ETH, settled automatically off a live price feed — no admin, no dispute.
          </p>
          <Link
            href="/app"
            className="mt-10 rounded-full bg-accent hover:bg-accent-dark text-gray-950 font-semibold px-8 py-3 text-base transition-colors"
          >
            Launch App
          </Link>
        </div>

        <section className="w-full max-w-5xl py-16 border-t border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center">What makes Polycat different</h2>
          <p className="text-gray-400 text-center max-w-lg mx-auto mt-3">
            Not another order book, and not another token launch — just a fast, mechanical way to trade a direction.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            <FeatureCard
              icon={<IconCurve />}
              title="Always someone to trade with"
              body="Every window is its own automated market maker on a Pythagorean bonding curve — there's a counterparty for every trade, even the very first one in a brand-new window. No order book, no waiting for a match."
            />
            <FeatureCard
              icon={<IconClock />}
              title="Fixed 5-minute windows"
              body="Every market runs exactly 5 minutes, aligned to the clock. The moment one settles, the next opens automatically — there's always a live window for every registered asset."
            />
            <FeatureCard
              icon={<IconGrid />}
              title="Curated, growing asset list"
              body="Blue chips like BTC, ETH, and SOL priced via Gate.com, plus Robinhood Chain memecoins like CashCat priced via DexScreener — added by the admin dashboard, not a code change."
            />
            <FeatureCard
              icon={<IconBolt />}
              title="Native ETH, one transaction"
              body="Buying is a single signed transaction — no separate approval step, no wrapped collateral token to hold first. Trade with the same ETH you already pay gas with."
            />
            <FeatureCard
              icon={<IconCheck />}
              title="Fully mechanical settlement"
              body="The observed close price decides the outcome automatically, straight off a live price feed — no admin judgment call, no bond, no dispute window, ever."
            />
            <FeatureCard
              icon={<IconNoToken />}
              title="No token"
              body="There's no Polycat token, and none is being sold or airdropped. Trading uses ETH, full stop — be wary of anyone claiming otherwise."
            />
          </div>
        </section>

        <section className="w-full max-w-3xl py-16 border-t border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center">How it works</h2>
          <div className="flex flex-col gap-6 mt-10 max-w-md mx-auto">
            <Step n={1} title="Connect a wallet" body="No signup, no email — just connect and you're ready to trade." />
            <Step
              n={2}
              title="Pick an asset and a side"
              body="Every card shows the strike price and the current implied chance of Up for its live 5-minute window."
            />
            <Step
              n={3}
              title="Buy Up or Down with ETH"
              body="One transaction, spend an exact ETH amount or an exact number of shares — your call."
            />
            <Step
              n={4}
              title="Sell, redeem, or let it settle"
              body="Exit anytime before close, or hold and redeem automatically once the window settles."
            />
          </div>
          <div className="flex justify-center mt-10">
            <Link
              href="/app"
              className="rounded-full bg-accent hover:bg-accent-dark text-gray-950 font-semibold px-8 py-3 text-base transition-colors"
            >
              Launch App
            </Link>
          </div>
        </section>
      </main>

      <footer className="max-w-5xl w-full mx-auto px-6 py-8 flex items-center justify-center gap-6 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Logo size={16} className="h-4 w-auto" />
          Polycat
        </span>
        <Link href="/docs" className="hover:text-gray-300">
          Docs
        </Link>
        <Link href="/app" className="hover:text-gray-300">
          Launch App
        </Link>
      </footer>
    </div>
  );
}
