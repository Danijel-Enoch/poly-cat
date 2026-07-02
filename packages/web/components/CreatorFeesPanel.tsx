"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract } from "@/lib/contracts";
import { formatUsdc } from "@/lib/format";
import { useClickRipple } from "@/components/ClickRipple";

export function CreatorFeesPanel({ marketId }: { marketId: bigint }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { onPointerDown: onWithdrawRipple, rippleLayer: withdrawRippleLayer } = useClickRipple();

  const { data: market, refetch } = useReadContract({
    ...marketFactoryContract,
    functionName: "getMarket",
    args: [marketId],
  });

  const isCreator = isConnected && !!address && !!market && address.toLowerCase() === market.creator.toLowerCase();

  if (!isCreator) return null;

  const creatorFees = market.creatorFees;
  const hasFees = creatorFees > 0n;

  async function handleWithdraw() {
    setSubmitting(true);
    setStatus("Withdrawing...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "withdrawCreatorFees",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Withdrawn!");
      await refetch();
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
      <h2 className="font-bold text-gray-100 mb-2">Creator fees</h2>
      <p className="text-sm text-gray-300 mb-4">
        You earn a 5% cut of trading fees on this market. Accrued so far: <strong>{formatUsdc(creatorFees)}</strong>
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleWithdraw}
        onPointerDown={onWithdrawRipple}
        disabled={submitting || !hasFees}
        className="relative overflow-hidden rounded-xl bg-accent hover:bg-accent-dark text-gray-900 py-2.5 px-5 text-sm font-semibold disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500"
      >
        {withdrawRippleLayer}
        {hasFees ? "Withdraw creator fees" : "No fees to withdraw yet"}
      </motion.button>
      {status && <p className="text-sm text-gray-400 mt-2">{status}</p>}
    </motion.div>
  );
}
