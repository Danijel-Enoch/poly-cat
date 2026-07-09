"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatEth } from "@/lib/format";
import type { PositionRow } from "@/lib/chainReads";
import { Button } from "@/components/ui/button";

/** Compact inline claim action for one portfolio row — a scaled-down sibling
 * of RedeemButton/ClaimRefundButton, which are full cards built for the
 * single-market page and too large to repeat per row in a list. Renders
 * nothing for a still-Trading position, or a Finalized position on the
 * losing side, since there's nothing to claim. */
export function PortfolioClaimButton({ position, onClaimed }: { position: PositionRow; onClaimed: () => void }) {
  const { writeContractAsync } = useWriteContract();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { market, upBalance, downBalance, marketId } = position;

  const winningBalance = market.state === "Finalized" ? (market.outcome ? upBalance : downBalance) : 0n;
  const refundableBalance = market.state === "Cancelled" ? upBalance + downBalance : 0n;
  const mode = winningBalance > 0n ? "redeem" : refundableBalance > 0n ? "refund" : null;

  if (!mode) return null;

  async function handleClaim() {
    setSubmitting(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: mode === "redeem" ? "redeem" : "claimRefund",
        args: [marketId],
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
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
      <p className="text-xs text-muted-foreground">
        {error ??
          (mode === "redeem"
            ? `Won ${formatEth(winningBalance)} ${COLLATERAL_SYMBOL} — ready to claim.`
            : `Pushed — ${formatEth(refundableBalance)} ${COLLATERAL_SYMBOL} refundable.`)}
      </p>
      <Button size="sm" disabled={submitting} onClick={handleClaim} className="shrink-0">
        {submitting ? "Claiming..." : mode === "redeem" ? "Claim" : "Claim refund"}
      </Button>
    </div>
  );
}
