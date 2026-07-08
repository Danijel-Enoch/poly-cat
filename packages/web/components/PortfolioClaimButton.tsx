"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatEth } from "@/lib/format";
import type { PositionRow } from "@/lib/chainReads";

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
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-800 pt-2">
      <p className="text-xs text-gray-500">
        {error ??
          (mode === "redeem"
            ? `Won ${formatEth(winningBalance)} ${COLLATERAL_SYMBOL} — claim ur bag.`
            : `Pushed — ${formatEth(refundableBalance)} ${COLLATERAL_SYMBOL} refundable, ser.`)}
      </p>
      <button
        type="button"
        onClick={handleClaim}
        disabled={submitting}
        className="shrink-0 rounded-lg bg-accent hover:bg-accent-dark text-gray-950 text-xs font-bold px-3 py-1.5 disabled:opacity-50"
      >
        {submitting ? "Claiming..." : mode === "redeem" ? "Claim" : "Claim refund"}
      </button>
    </div>
  );
}
