import { getLeaderboard } from "@/lib/leaderboard";
import { formatUsdc, shortenAddress } from "@/lib/format";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Leaderboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Ranked by total trading volume across all markets.</p>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No trades yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {entries.map((entry, index) => (
            <div key={entry.address} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-8 text-center font-bold text-gray-400 dark:text-gray-500">
                  {MEDALS[index] ?? index + 1}
                </span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {shortenAddress(entry.address)}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {formatUsdc(entry.volume)} <span className="text-gray-400 dark:text-gray-500 font-normal">USDC</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
