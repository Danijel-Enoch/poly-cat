"use client";

import { useState } from "react";
import Link from "next/link";
import { usePonderQuery } from "@ponder/react";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { redeemablePositionsQuery, isActuallyRedeemable, type RedeemableRow } from "@/lib/ponderQueries";
import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatEth } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { HoloCard } from "@/components/HoloCard";

/** Every market this wallet has ever entered that's now resolved and still
 * unclaimed — the full-history counterpart to the "Ur bag" list below it on
 * this page, which only scans the most recent ~300 markets (see
 * lib/chainReads.ts's getUserPositions). Backed by packages/indexer instead
 * of a bounded on-chain scan, so nothing falls out of view no matter how
 * long ago a position was opened. */
export function NeedsRedeemingList() {
  const { address, isConnected } = useAccount();
  const [justClaimed, setJustClaimed] = useState<Set<string>>(new Set());

  const { data: rows, status } = usePonderQuery({
    queryFn: (db) => redeemablePositionsQuery(db, address!),
    enabled: !!address,
  });

  if (!isConnected) return null;

  const redeemable = (rows ?? []).filter(
    (row) => isActuallyRedeemable(row) && !justClaimed.has(row.marketId.toString()),
  );

  if (status === "pending") {
    return (
      <HoloCard radius={20} innerClassName="p-5">
        <p className="text-sm text-gray-400">Checking your full trade history for unclaimed bags...</p>
      </HoloCard>
    );
  }

  if (status === "error") {
    return null; // indexer unreachable — the "Ur bag" list below still covers recent markets directly on-chain
  }

  if (redeemable.length === 0) return null;

  return (
    <HoloCard radius={20} innerClassName="p-5">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
        Needs redeeming — {redeemable.length} bag{redeemable.length === 1 ? "" : "s"} across your full history
      </p>
      <div className="flex flex-col gap-2">
        {redeemable.map((row) => (
          <RedeemableRowItem
            key={row.marketId.toString()}
            row={row}
            onClaimed={() => setJustClaimed((prev) => new Set(prev).add(row.marketId.toString()))}
          />
        ))}
      </div>
    </HoloCard>
  );
}

function RedeemableRowItem({ row, onClaimed }: { row: RedeemableRow; onClaimed: () => void }) {
  const { writeContractAsync } = useWriteContract();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = row.state === "Finalized" ? "redeem" : "refund";
  const amount = row.outcome ? row.upBalance : row.downBalance;
  const claimAmount = row.state === "Finalized" ? amount : row.upBalance + row.downBalance;

  async function handleClaim() {
    setSubmitting(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: mode === "redeem" ? "redeem" : "claimRefund",
        args: [row.marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      onClaimed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-gray-900/60 border border-gray-800 px-3 py-2">
      <Link href={`/markets/${row.marketId}`} className="min-w-0">
        <p className="text-sm font-bold text-gray-100 uppercase tracking-wide truncate">
          {assetDisplayName(row.assetSymbol)}
        </p>
        <p className="text-xs text-gray-500">
          {error ??
            (mode === "redeem"
              ? `Won ${formatEth(claimAmount)} ${COLLATERAL_SYMBOL}`
              : `Pushed — ${formatEth(claimAmount)} ${COLLATERAL_SYMBOL} refundable`)}
        </p>
      </Link>
      <button
        type="button"
        onClick={handleClaim}
        disabled={submitting}
        className="shrink-0 rounded-lg bg-accent hover:bg-accent-dark text-gray-950 text-xs font-bold px-3 py-1.5 disabled:opacity-50"
      >
        {submitting ? "Claiming..." : mode === "redeem" ? "Claim bag 🐒" : "Claim refund"}
      </button>
    </div>
  );
}
