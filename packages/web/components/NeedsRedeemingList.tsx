"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { fetchRedeemablePositions, isActuallyRedeemable, type RedeemableRow } from "@/lib/indexerApi";
import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatEth } from "@/lib/format";
import { assetDisplayName } from "@/lib/assets";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Every market this wallet has ever entered that's now resolved and still
 * unclaimed — the full-history counterpart to the open-positions list below
 * it on this page, which only scans the most recent ~300 markets (see
 * lib/chainReads.ts's getUserPositions). Backed by packages/indexer instead
 * of a bounded on-chain scan, so nothing falls out of view no matter how
 * long ago a position was opened. */
export function NeedsRedeemingList() {
  const { address, isConnected } = useAccount();
  const [justClaimed, setJustClaimed] = useState<Set<string>>(new Set());

  const { data: rows, status } = useQuery({
    queryKey: ["indexerRedeemablePositions", address],
    queryFn: () => fetchRedeemablePositions(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });

  if (!isConnected) return null;

  const redeemable = (rows ?? []).filter(
    (row) => isActuallyRedeemable(row) && !justClaimed.has(row.marketId.toString()),
  );

  if (status === "pending") {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">Checking your full trade history for unclaimed positions...</p>
        </CardContent>
      </Card>
    );
  }

  if (status === "error") {
    return null; // indexer unreachable — the open-positions list below still covers recent markets directly on-chain
  }

  if (redeemable.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-xs uppercase tracking-wide text-muted-foreground font-normal">
          Needs redeeming — {redeemable.length} position{redeemable.length === 1 ? "" : "s"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {redeemable.map((row) => (
          <RedeemableRowItem
            key={row.marketId.toString()}
            row={row}
            onClaimed={() => setJustClaimed((prev) => new Set(prev).add(row.marketId.toString()))}
          />
        ))}
      </CardContent>
    </Card>
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
    <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <Link href={`/markets/${row.marketId}`} className="min-w-0">
        <p className="text-sm font-medium truncate">{assetDisplayName(row.assetSymbol)}</p>
        <p className="text-xs text-muted-foreground">
          {error ??
            (mode === "redeem"
              ? `Won ${formatEth(claimAmount)} ${COLLATERAL_SYMBOL}`
              : `Pushed — ${formatEth(claimAmount)} ${COLLATERAL_SYMBOL} refundable`)}
        </p>
      </Link>
      <Button size="sm" disabled={submitting} onClick={handleClaim} className="shrink-0">
        {submitting ? "Claiming..." : mode === "redeem" ? "Claim" : "Claim refund"}
      </Button>
    </div>
  );
}
