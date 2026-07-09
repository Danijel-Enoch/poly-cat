import { notFound } from "next/navigation";
import { getMarket, getAsset } from "@/lib/chainReads";
import { TradePanel } from "@/components/TradePanel";
import { RedeemButton } from "@/components/RedeemButton";
import { ClaimRefundButton } from "@/components/ClaimRefundButton";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { ProbabilityDisplay, ProbabilityBar } from "@/components/ProbabilityDisplay";
import { formatDate, upProbabilityFromSupplies, formatPriceWad } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssetIcon } from "@/components/AssetIcon";

// See app/(dapp)/app/page.tsx for why this must stay dynamic — same reason:
// live chain reads, never build-time prerendered.
export const dynamic = "force-dynamic";

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(BigInt(id));

  if (!market) notFound();

  const asset = await getAsset(market.assetId);
  const upPct = Math.round(upProbabilityFromSupplies(market.upSupply, market.downSupply) * 100);
  const isTrading = market.state === "Trading";

  return (
    <div className="grid gap-6 lg:grid-cols-3 items-start">
      <div className="min-w-0 lg:col-span-2 flex flex-col gap-6">
        <Card>
          <CardContent>
            <div className="flex items-start gap-3">
              <AssetIcon asset={asset} className="h-12 w-12 shrink-0 rounded-full" textClassName="text-sm" />
              <div className="flex-1 min-w-0">
                <Badge variant="outline" className="mb-1.5">
                  5m window
                </Badge>
                <h1 className="text-xl font-display tracking-tight">{assetDisplayName(asset.symbol)} — Up or Down?</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Strike ${formatPriceWad(market.startPriceWad)} at {formatDate(market.startTime)} · Closes{" "}
                  {formatDate(market.closeTime)}
                </p>
                {market.state === "Finalized" && (
                  <div className="mt-1.5">
                    <Badge variant={market.outcome ? "up" : "down"}>
                      Settled ${formatPriceWad(market.closePriceWad)} — {market.outcome ? "Up won" : "Down won"}
                    </Badge>
                  </div>
                )}
                {market.state === "Cancelled" && (
                  <div className="mt-1.5">
                    <Badge variant="secondary">Pushed — strike matched exactly, full refund</Badge>
                  </div>
                )}
              </div>
              <ProbabilityDisplay upPct={upPct} />
            </div>
            <ProbabilityBar upPct={upPct} />
          </CardContent>
        </Card>

        <PriceHistoryChart
          assetId={asset.id}
          source={asset.source}
          sourceId={asset.sourceId}
          startTime={market.startTime}
          closeTime={market.closeTime}
          startPriceWad={market.startPriceWad}
          isTrading={isTrading}
        />

        <TradeHistoryTable marketId={market.id} />

        <RedeemButton marketId={market.id} />
        <ClaimRefundButton marketId={market.id} />
      </div>

      <div className="min-w-0 lg:sticky lg:top-20">
        <TradePanel marketId={market.id} />
      </div>
    </div>
  );
}
