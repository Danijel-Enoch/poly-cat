"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract } from "@/lib/contracts";
import { formatUsdc } from "@/lib/format";
import { useClickRipple } from "@/components/ClickRipple";

const MARKET_STATE_FINALIZED = 1;

export function RedeemButton({ marketId }: { marketId: bigint }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { onPointerDown: onRedeemRipple, rippleLayer: redeemRippleLayer } = useClickRipple();

  const { data: market } = useReadContract({
    ...marketFactoryContract,
    functionName: "getMarket",
    args: [marketId],
  });

  const { data: winningBalance, refetch } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address && market ? [marketId, market.outcome, address] : undefined,
    query: { enabled: !!address && !!market && market.state === MARKET_STATE_FINALIZED },
  });

  if (!isConnected || !market || market.state !== MARKET_STATE_FINALIZED) return null;

  async function handleRedeem() {
    setSubmitting(true);
    setStatus("Redeeming...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "redeem",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Redeemed!");
      // hasWinnings gates this button, so a successful redeem here always means a
      // real payout — this is the "you won" moment worth celebrating.
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ["#ccff00", "#059669", "#ffffff"] });
      await refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  const hasWinnings = winningBalance !== undefined && winningBalance > 0n;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5"
    >
      <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Redeem</h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Outcome: <strong>{market.outcome ? "YES" : "NO"}</strong>. Your winning shares:{" "}
        {formatUsdc(winningBalance ?? 0n)}
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleRedeem}
        onPointerDown={onRedeemRipple}
        disabled={submitting || !hasWinnings}
        className="relative overflow-hidden rounded-xl bg-accent hover:bg-accent-dark text-gray-900 py-2.5 px-5 text-sm font-semibold disabled:opacity-50 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500"
      >
        {redeemRippleLayer}
        {hasWinnings ? "Redeem winnings" : "Nothing to redeem"}
      </motion.button>
      {status && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{status}</p>}
    </motion.div>
  );
}
