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

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  const { data: positions, isLoading } = useQuery({
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
      <div className="max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-gray-400 text-sm">Connect your wallet to see your positions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-gray-100">Your positions</h1>

      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total portfolio value</p>
        <p className="text-3xl font-extrabold text-gray-100 mt-1">
          {totalValue === null ? "—" : `${formatEth(totalValue)} ${COLLATERAL_SYMBOL}`}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          What you&apos;d receive selling everything right now, or redeeming resolved positions.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !positions || positions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900 py-16 text-center">
          <p className="text-gray-400 text-sm">No open positions yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {positions.map((position) => (
            <Link
              key={position.marketId.toString()}
              href={`/markets/${position.marketId}`}
              className="rounded-2xl border border-gray-800 bg-gray-900 p-4 hover:shadow-md hover:border-gray-600 transition-all flex items-center justify-between"
            >
              <span className="text-sm font-semibold text-gray-100">{assetDisplayName(position.asset.symbol)}</span>
              <div className="flex gap-2 text-sm">
                <span className="rounded-lg bg-emerald-950 text-emerald-400 px-3 py-1 font-semibold">
                  Up: {formatEth(position.upBalance)}
                </span>
                <span className="rounded-lg bg-rose-950 text-rose-400 px-3 py-1 font-semibold">
                  Down: {formatEth(position.downBalance)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
