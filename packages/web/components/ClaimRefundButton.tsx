"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, USDC_DECIMALS, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatCollateral } from "@/lib/format";
import { useClickRipple } from "@/components/ClickRipple";

const MARKET_STATE_CANCELLED = 2;

export function ClaimRefundButton({ marketId }: { marketId: bigint }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { onPointerDown: onClaimRipple, rippleLayer: claimRippleLayer } = useClickRipple();

  const { data: market } = useReadContract({
    ...marketFactoryContract,
    functionName: "getMarket",
    args: [marketId],
  });

  const { data: upBalance, refetch: refetchUp } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address ? [marketId, true, address] : undefined,
    query: { enabled: !!address && market?.state === MARKET_STATE_CANCELLED },
  });

  const { data: downBalance, refetch: refetchDown } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address ? [marketId, false, address] : undefined,
    query: { enabled: !!address && market?.state === MARKET_STATE_CANCELLED },
  });

  if (!isConnected || !market || market.state !== MARKET_STATE_CANCELLED) return null;

  const heldShares = (upBalance ?? 0n) + (downBalance ?? 0n);
  const hasSharesToClaim = heldShares > 0n;

  async function handleClaim() {
    setSubmitting(true);
    setStatus("Claiming refund...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "claimRefund",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Refund claimed!");
      await Promise.all([refetchUp(), refetchDown()]);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-gray-800 bg-gray-900 p-5"
    >
      <h2 className="font-bold text-gray-100 mb-2">Market pushed</h2>
      <p className="text-sm text-gray-300 mb-4">
        This window closed at the exact same price it started — a push, not a win for either side. You held{" "}
        {formatCollateral(heldShares, USDC_DECIMALS)} {COLLATERAL_SYMBOL} worth of shares, and can claim your
        pro-rata share of the pool back.
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleClaim}
        onPointerDown={onClaimRipple}
        disabled={submitting || !hasSharesToClaim}
        className="relative overflow-hidden rounded-xl bg-accent hover:bg-accent-dark text-white py-2.5 px-5 text-sm font-semibold disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500"
      >
        {claimRippleLayer}
        {hasSharesToClaim ? "Claim refund" : "Nothing to claim"}
      </motion.button>
      {status && <p className="text-sm text-gray-400 mt-2">{status}</p>}
    </motion.div>
  );
}
