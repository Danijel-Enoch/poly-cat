"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { fetchPnlLeaderboard } from "@/lib/indexerApi";
import { formatEth, shortenAddress } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Repurposed from the reference's customer "Testimonials" section —
 * Polycat has no customers to quote, so this shows the real top of the
 * live PnL leaderboard instead (see components/PnlLeaderboard.tsx for the
 * full table on /leaderboard). */
export function LeaderboardTeaserSection() {
  const { data } = useQuery({
    queryKey: ["pnlLeaderboard", "teaser"],
    queryFn: () => fetchPnlLeaderboard(3),
  });

  return (
    <section className="relative py-24 lg:py-32 border-t border-border">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-4">
              <span className="w-8 h-px bg-foreground/30" />
              Leaderboard
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight text-balance">Ranked by realized PnL.</h2>
          </div>
          <Link href="/leaderboard" className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
            Full leaderboard
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-px bg-border border border-border">
          {(data ?? []).map((row, i) => {
            const isProfit = row.pnl >= 0n;
            return (
              <div key={row.address} className="bg-background p-8">
                <span className="font-mono text-sm text-muted-foreground">#{i + 1}</span>
                <p className="font-mono text-lg mt-3">{shortenAddress(row.address)}</p>
                <p className={`text-2xl font-display mt-2 ${isProfit ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                  {isProfit ? "+" : "-"}
                  {formatEth(isProfit ? row.pnl : -row.pnl)} {COLLATERAL_SYMBOL}
                </p>
              </div>
            );
          })}
          {!data &&
            [0, 1, 2].map((i) => (
              <div key={i} className="bg-background p-8">
                <span className="font-mono text-sm text-muted-foreground">#{i + 1}</span>
                <p className="font-mono text-lg mt-3 text-muted-foreground">—</p>
              </div>
            ))}
        </div>
      </div>
    </section>
  );
}
