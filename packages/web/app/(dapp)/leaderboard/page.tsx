import { PnlLeaderboard } from "@/components/PnlLeaderboard";

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-100 uppercase tracking-tight">Leaderboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Top 100 traders by all-time realized PnL, across every market and every asset. Updated live from
          packages/indexer.
        </p>
      </div>

      <PnlLeaderboard />
    </div>
  );
}
