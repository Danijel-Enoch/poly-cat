"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";

import { getUserPositions } from "@/lib/chainReads";
import { formatEth } from "@/lib/format";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { quoteSell, CurveQuoteError } from "@/lib/curveMath";
import { assetDisplayName } from "@/lib/assets";
import { PortfolioClaimButton } from "@/components/PortfolioClaimButton";
import { NeedsRedeemingList } from "@/components/NeedsRedeemingList";
import { PnlShareCard } from "@/components/PnlShareCard";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  const {
    data: positions,
    isLoading,
    refetch: refetchPositions,
  } = useQuery({
    queryKey: ["positions", address],
    queryFn: () => getUserPositions(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const { data: feeBps } = useReadContract({ ...marketFactoryContract, functionName: "feeBps" });

  const totalValue = useMemo(() => {
    if (!positions || feeBps === undefined) return null;
    let total = 0n;
    for (const position of positions) {
      const { market, upBalance, downBalance } = position;
      if (market.state === "Finalized") {
        total += market.outcome ? upBalance : downBalance;
        continue;
      }
      if (market.state === "Cancelled") continue; // claim via ClaimRefundButton on the market page instead
      if (upBalance > 0n) {
        try {
          total += quoteSell(market.reserve, market.upSupply, market.downSupply, upBalance, BigInt(feeBps)).collateralOut;
        } catch (err) {
          if (!(err instanceof CurveQuoteError)) throw err;
        }
      }
      if (downBalance > 0n) {
        try {
          total += quoteSell(market.reserve, market.downSupply, market.upSupply, downBalance, BigInt(feeBps)).collateralOut;
        } catch (err) {
          if (!(err instanceof CurveQuoteError)) throw err;
        }
      }
    }
    return total;
  }, [positions, feeBps]);

  if (!isConnected) {
    return (
      <Card className="max-w-lg">
        <CardContent className="text-center py-4">
          <p className="text-muted-foreground text-sm">Connect your wallet to see your positions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <PageHeader eyebrow="Your account" title="Portfolio" />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Total value"
          value={totalValue === null ? "—" : formatEth(totalValue)}
          description={totalValue === null ? undefined : `${COLLATERAL_SYMBOL} · what you'd get exiting everything now`}
        />

        {address && <PnlShareCard address={address} />}
      </div>

      <NeedsRedeemingList />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !positions || positions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No open positions yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {positions.map((position) => (
            <Card key={position.marketId.toString()}>
              <CardContent>
                <Link href={`/markets/${position.marketId}`} className="flex items-center justify-between">
                  <span className="text-sm font-display text-lg">{assetDisplayName(position.asset.symbol)}</span>
                  <div className="flex gap-2 text-sm">
                    <Badge variant="up">Up: {formatEth(position.upBalance)}</Badge>
                    <Badge variant="down">Down: {formatEth(position.downBalance)}</Badge>
                  </div>
                </Link>
                <PortfolioClaimButton position={position} onClaimed={() => refetchPositions()} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
