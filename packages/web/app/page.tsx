import Link from "next/link";
import { getMarkets } from "@/lib/ponder";
import { MarketsBrowser } from "@/components/MarketsBrowser";

export default async function Home() {
  const markets = await getMarkets();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Markets</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Trade on the outcome of anything.</p>
      </div>

      {markets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">No markets yet.</p>
          <Link
            href="/create"
            className="inline-block text-sm font-semibold px-4 py-2 rounded-full bg-accent text-gray-900 hover:bg-accent-dark"
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <MarketsBrowser markets={markets} />
      )}
    </div>
  );
}
