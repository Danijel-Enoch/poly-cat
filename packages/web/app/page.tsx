import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HoloCard } from "@/components/HoloCard";

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
    <HoloCard radius={20} innerClassName="p-5 text-left">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-accent glow-accent">
        {icon}
      </span>
      <p className="font-bold text-gray-100 mt-3 uppercase tracking-wide">{title}</p>
      <p className="text-sm text-gray-400 leading-relaxed mt-1.5">{body}</p>
    </HoloCard>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4 text-left">
      <span className="shrink-0 h-7 w-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-accent">
        {n}
      </span>
      <div>
        <p className="font-bold text-sm text-gray-100 uppercase tracking-wide">{title}</p>
        <p className="text-sm text-gray-400 leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex flex-col items-center px-6">
        <div className="flex flex-col items-center text-center pt-16 pb-14">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent mb-4 text-glow-accent">
            gm degens · built on Robinhood Chain
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-2xl">
            <span className="degen-gradient-text bg-clip-text text-transparent">Ape Up or Down.</span>
            <br />
            Every 5 minutes.
          </h1>
          <p className="text-gray-400 max-w-xl mt-5 text-base sm:text-lg">
            Pick a token — blue chips like BTC, ETH, SOL, or Robinhood Chain memecoins — and ape Up or Down
            before its 5-minute window closes. Down wins if the price dips below the strike, Up wins if it
            rips higher. Pure ETH, settled off a live feed. No admin, no dispute, no KYC. Probably nothing.
            WAGMI.
          </p>
          <Link
            href="/app"
            className="mt-10 rounded-full bg-accent hover:bg-accent-dark text-gray-950 font-bold px-8 py-3 text-base transition-shadow glow-accent uppercase tracking-wide"
          >
            Ape in 🐒
          </Link>
        </div>

        <section className="w-full max-w-5xl py-14 border-t border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center uppercase">
            Why this isn&apos;t another NGMI launch
          </h2>
          <p className="text-gray-400 text-center max-w-lg mx-auto mt-3">
            Not an order book, not a token presale — just a fast, mechanical way to ape a direction every 5 minutes.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
            <FeatureCard
              icon={<IconCurve />}
              title="Always someone to ape with"
              body="Every window is its own AMM on a Pythagorean bonding curve — there's a counterparty for every trade, even the very first one in a fresh window. No order book, no waiting for a match."
            />
            <FeatureCard
              icon={<IconClock />}
              title="Fixed 5-minute windows"
              body="Every market runs exactly 5 minutes, aligned to the clock. The second one settles, the next opens — there's always a live window for every registered asset. Wen? Now."
            />
            <FeatureCard
              icon={<IconGrid />}
              title="Curated, growing bag"
              body="Blue chips like BTC, ETH, SOL priced via Gate.com, plus Robinhood Chain memecoins like CashCat via DexScreener — added by the admin dashboard, not a code change."
            />
            <FeatureCard
              icon={<IconBolt />}
              title="Native ETH, one tx"
              body="Buying is a single signed transaction — no approval step, no wrapped collateral token to hold first. Trade with the same ETH you pay gas in, ser."
            />
            <FeatureCard
              icon={<IconCheck />}
              title="Mechanical settlement"
              body="The observed close price decides it automatically, straight off a live feed — no admin judgment call, no bond, no dispute window, ever. rekt-proof finality."
            />
            <FeatureCard
              icon={<IconNoToken />}
              title="No token. Seriously."
              body="There's no Polycat token, and none is being sold or airdropped. Trading uses ETH, full stop — anyone claiming otherwise is NGMI. Stay safe, fren."
            />
          </div>
        </section>

        <section className="w-full max-w-3xl py-14 border-t border-gray-800">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-center uppercase">How to ape</h2>
          <div className="flex flex-col gap-6 mt-10 max-w-md mx-auto">
            <Step n={1} title="Connect a wallet" body="No signup, no email — connect and you're ready to send it." />
            <Step
              n={2}
              title="Pick a token + a side"
              body="Every card shows the strike and the live implied chance of Up for its 5-minute window."
            />
            <Step
              n={3}
              title="Ape Up or Down with ETH"
              body="One tx — spend an exact ETH amount or target an exact share count. Your call, degens."
            />
            <Step
              n={4}
              title="Exit, redeem, or let it cook"
              body="Peg out before close, or hold and auto-redeem once the window settles. WAGMI."
            />
          </div>
          <div className="flex justify-center mt-10">
            <Link
              href="/app"
              className="rounded-full bg-accent hover:bg-accent-dark text-gray-950 font-bold px-8 py-3 text-base transition-shadow glow-accent uppercase tracking-wide"
            >
              Ape in 🐒
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
          Ape in
        </Link>
      </footer>
    </div>
  );
}
