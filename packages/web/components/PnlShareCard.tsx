"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

import { fetchTraderStats, fetchTraderMarketCount, pnlFromTraderStats } from "@/lib/indexerApi";
import { formatEth } from "@/lib/format";
import { COLLATERAL_SYMBOL } from "@/lib/contracts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Preview + "Share PnL" button for the portfolio page. The image itself is
 * generated server-side by app/api/pnl-card/route.tsx (same next/og
 * technique as the site-wide opengraph-image.tsx) — this component just
 * shows the same numbers inline and fetches that route as a downloadable/
 * shareable PNG on demand. Deliberately not a public page: nothing here is
 * linked anywhere, it only ever runs for the connected wallet. */
export function PnlShareCard({ address }: { address: Address }) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["traderStats", address],
    queryFn: async () => {
      const [stats, marketCount] = await Promise.all([fetchTraderStats(address), fetchTraderMarketCount(address)]);
      return { stats, marketCount };
    },
    refetchInterval: 10_000,
  });

  const pnl = data ? pnlFromTraderStats(data.stats) : null;
  const isProfit = pnl !== null && pnl >= 0n;
  const hasTraded = !!data && data.stats.buyCount > 0;

  async function handleShare() {
    setSharing(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/pnl-card?address=${address}`);
      if (!res.ok) throw new Error("Card generation failed");
      const blob = await res.blob();
      const file = new File([blob], "polycat-pnl.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Polycat PnL" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "polycat-pnl.png";
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // A user cancelling the native share sheet also lands here (AbortError) — not a real failure.
      if (err instanceof Error && err.name === "AbortError") return;
      setShareError("Couldn't generate the card — try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-xs uppercase tracking-wide text-muted-foreground font-normal">
          PnL, all-time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-display text-4xl leading-none" style={!hasTraded ? undefined : { color: isProfit ? "var(--up)" : "var(--down)" }}>
          {!hasTraded || pnl === null ? "—" : `${pnl >= 0n ? "+" : "-"}${formatEth(pnl >= 0n ? pnl : -pnl)} ${COLLATERAL_SYMBOL}`}
        </p>
        <p className="text-xs text-muted-foreground mt-1.5">
          {hasTraded && data
            ? `${(data.stats.buyCount + data.stats.sellCount).toLocaleString()} trades across ${data.marketCount.toLocaleString()} markets`
            : "Trade a market to see your PnL here."}
        </p>
        <Button variant="default" className="mt-4 w-full" disabled={!hasTraded || sharing} onClick={handleShare}>
          {sharing ? "Generating…" : "Share PnL"}
        </Button>
        {shareError && <p className="text-xs text-destructive mt-2">{shareError}</p>}
      </CardContent>
    </Card>
  );
}
