"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { getPositionsForHolder } from "@/lib/ponder";
import { formatUsdc } from "@/lib/format";
import { marketFactoryContract } from "@/lib/contracts";
import { quoteSell, CurveQuoteError } from "@/lib/curveMath";

const MARKET_STATE_FINALIZED = 1;

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions", address],
    queryFn: () => getPositionsForHolder(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });

  const openPositions = useMemo(
    () => (positions ?? []).filter((p) => BigInt(p.yesBalance) > 0n || BigInt(p.noBalance) > 0n),
    [positions],
  );

  const { data: feeBps } = useReadContract({ ...marketFactoryContract, functionName: "feeBps" });

  const { data: marketsData } = useReadContracts({
    contracts: openPositions.map((p) => ({
      ...marketFactoryContract,
      functionName: "getMarket" as const,
      args: [BigInt(p.marketId)] as const,
    })),
    query: { enabled: openPositions.length > 0 },
  });

  const totalValue = useMemo(() => {
    if (openPositions.length === 0) return 0n;
    if (!marketsData || feeBps === undefined) return null;
    let total = 0n;
    openPositions.forEach((position, i) => {
      const result = marketsData[i];
      if (!result || result.status !== "success") return;
      const m = result.result;
      const yesBal = BigInt(position.yesBalance);
      const noBal = BigInt(position.noBalance);

      if (m.state === MARKET_STATE_FINALIZED) {
        total += m.outcome ? yesBal : noBal;
        return;
      }
      if (yesBal > 0n) {
        try {
          total += quoteSell(m.reserve, m.yesSupply, m.noSupply, yesBal, BigInt(feeBps)).collateralOut;
        } catch (err) {
          if (!(err instanceof CurveQuoteError)) throw err;
        }
      }
      if (noBal > 0n) {
        try {
          total += quoteSell(m.reserve, m.noSupply, m.yesSupply, noBal, BigInt(feeBps)).collateralOut;
        } catch (err) {
          if (!(err instanceof CurveQuoteError)) throw err;
        }
      }
    });
    return total;
  }, [marketsData, feeBps, openPositions]);

  if (!isConnected) {
    return (
      <div className="max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Connect your wallet to see your positions.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Your positions</h1>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Total portfolio value
        </p>
        <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">
          {totalValue === null ? "—" : `$${formatUsdc(totalValue)}`}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          What you&apos;d receive selling everything right now, or redeeming resolved positions.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      ) : openPositions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-16 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No open positions yet.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {openPositions.map((position) => (
            <Link
              key={position.id}
              href={`/markets/${position.marketId}`}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all flex items-center justify-between"
            >
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Market #{position.marketId}</span>
              <div className="flex gap-2 text-sm">
                <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 px-3 py-1 font-semibold">
                  Yes: {formatUsdc(position.yesBalance)}
                </span>
                <span className="rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 px-3 py-1 font-semibold">
                  No: {formatUsdc(position.noBalance)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
