import { notFound } from "next/navigation";
import { getMarket } from "@/lib/ponder";
import { TradePanel } from "@/components/TradePanel";
import { SettleActions } from "@/components/SettleActions";
import { RedeemButton } from "@/components/RedeemButton";
import { CreatorFeesPanel } from "@/components/CreatorFeesPanel";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { TradeHistoryTable } from "@/components/TradeHistoryTable";
import { ProbabilityDisplay, ProbabilityBar } from "@/components/ProbabilityDisplay";
import { formatDate, shortenAddress, yesProbabilityFromSupplies } from "@/lib/format";
import { avatarColorFor } from "@/lib/avatarColor";
import { parseMetadataURI } from "@/lib/category";

export default async function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const market = await getMarket(id);

  if (!market) notFound();

  const marketId = BigInt(id);
  const { category, title: parsedTitle } = parseMetadataURI(market.metadataURI);
  const title = parsedTitle || market.questionHash;
  const yesPct = Math.round(yesProbabilityFromSupplies(market.yesSupply, market.noSupply) * 100);

  return (
    <div className="grid gap-6 lg:grid-cols-3 items-start">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-start gap-3">
            <span
              className={`h-12 w-12 shrink-0 rounded-full ${avatarColorFor(market.id)} flex items-center justify-center text-white font-bold`}
            >
              {title.replace("ipfs://", "").charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              {category && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent/30 text-gray-200 mb-1">
                  {category}
                </span>
              )}
              <h1 className="text-xl font-extrabold text-gray-100 break-words">{title}</h1>
              <p className="text-sm text-gray-400 mt-1">
                Created by {shortenAddress(market.creator)} · Closes {formatDate(market.closeTime)}
              </p>
            </div>
            <ProbabilityDisplay yesPct={yesPct} />
          </div>
          <ProbabilityBar yesPct={yesPct} />
        </div>

        <PriceHistoryChart marketId={marketId} createdAt={BigInt(market.createdAt)} closeTime={BigInt(market.closeTime)} />

        <TradeHistoryTable marketId={marketId} />

        <SettleActions marketId={marketId} closeTime={BigInt(market.closeTime)} state={market.state} />
        <RedeemButton marketId={marketId} />
        <CreatorFeesPanel marketId={marketId} />
      </div>

      <div className="lg:sticky lg:top-20">
        <TradePanel marketId={marketId} />
      </div>
    </div>
  );
}
