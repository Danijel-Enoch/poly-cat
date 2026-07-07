import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-5xl w-full mx-auto px-6 pt-6">
        <header className="rounded-2xl border border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo-mark.png" alt="HoodMarkets" width={51} height={36} className="h-9 w-auto" priority />
            <span className="font-semibold tracking-tight text-lg">HoodMarkets</span>
          </div>
          <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-white">
            Docs
          </Link>
        </header>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <span className="text-xs font-semibold uppercase tracking-wide text-accent mb-4">Built on Robinhood Chain</span>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight max-w-2xl">
          The first prediction market on Robinhood Chain
        </h1>
        <p className="text-gray-400 max-w-xl mt-5 text-base sm:text-lg">
          Create a market on anything. Trade Yes or No shares on a live bonding-curve price. Settled fast, no
          middlemen.
        </p>
        <Link
          href="/app"
          className="mt-10 rounded-full bg-accent hover:bg-accent-dark text-gray-900 font-semibold px-8 py-3 text-base transition-colors"
        >
          Launch App
        </Link>
        <p className="mt-8 text-xs text-gray-500">
          Backed by Umbrella Labs, Alphatoken Capital, and Web3 Ventures
        </p>
      </main>

      <footer className="max-w-5xl w-full mx-auto px-6 py-8 flex items-center justify-center gap-6 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <Image src="/logo-mark.png" alt="" width={23} height={16} className="h-4 w-auto" />
          HoodMarkets
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
