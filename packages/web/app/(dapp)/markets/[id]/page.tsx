import { notFound } from "next/navigation";
import { getMarket, getAsset } from "@/lib/chainReads";
import { TradePanel } from "@/components/TradePanel";
import { RedeemButton } from "@/components/RedeemButton";
import { ClaimRefundButton } from "@/components/ClaimRefundButton";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { ProbabilityDisplay, ProbabilityBar } from "@/components/ProbabilityDisplay";
import { formatDate, upProbabilityFromSupplies, formatPriceWad } from "@/lib/format";
import { assetDisplayName, assetColor } from "@/lib/assets";
import { HoloCard } from "@/components/HoloCard";

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
        <HoloCard radius={20} innerClassName="p-5">
          <div className="flex items-start gap-3">
            <span
              className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: assetColor(asset.symbol) }}
            >
              {asset.symbol.slice(0, 4)}
            </span>
            <div className="flex-1 min-w-0">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#1b1300] text-gray-200 mb-1">
                5m window
              </span>
              <h1 className="text-xl font-extrabold text-gray-100 uppercase tracking-tight">{assetDisplayName(asset.symbol)} — Up or Down?</h1>
              <p className="text-sm text-gray-400 mt-1">
                Strike ${formatPriceWad(market.startPriceWad)} at {formatDate(market.startTime)} · Closes{" "}
                {formatDate(market.closeTime)}
              </p>
              {market.state === "Finalized" && (
                <p className="text-sm font-bold mt-1 text-gray-200">
                  Settled at ${formatPriceWad(market.closePriceWad)} — {market.outcome ? "Up won 🟢" : "Down won 🔴"}
                </p>
              )}
              {market.state === "Cancelled" && (
                <p className="text-sm font-bold mt-1 text-gray-200">
                  Pushed — close matched the strike exactly. rekt-free refund.
                </p>
              )}
            </div>
            <ProbabilityDisplay upPct={upPct} />
          </div>
          <ProbabilityBar upPct={upPct} />
        </HoloCard>

        <PriceHistoryChart
          assetId={asset.id}
          source={asset.source}
          sourceId={asset.sourceId}
          startTime={market.startTime}
          closeTime={market.closeTime}
          startPriceWad={market.startPriceWad}
          isTrading={isTrading}
        />

        <TradeHistoryTable marketId={market.id} startTime={market.startTime} />

        <RedeemButton marketId={market.id} />
        <ClaimRefundButton marketId={market.id} />
      </div>

      <div className="min-w-0 lg:sticky lg:top-20">
        <TradePanel marketId={market.id} />
      </div>
    </div>
  );
}
