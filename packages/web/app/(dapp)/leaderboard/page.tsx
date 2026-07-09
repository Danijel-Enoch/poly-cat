import { PnlLeaderboard } from "@/components/PnlLeaderboard";
import { PageHeader } from "@/components/ui/page-header";

export default function LeaderboardPage() {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Season 1" title="Leaderboard" description="Top 100 traders by all-time realized PnL, across every market and asset." />

      <PnlLeaderboard />
    </div>
  );
}
