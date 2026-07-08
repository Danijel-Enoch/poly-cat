"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_DECIMALS, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatCollateral } from "@/lib/format";
import { useClickRipple } from "@/components/ClickRipple";
import { HoloCard } from "@/components/HoloCard";

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
    setStatus("Claiming ur bag...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "redeem",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("WAGMI 🐒");
      // hasWinnings gates this button, so a successful redeem here always means a
      // real payout — this is the "you won" moment worth celebrating.
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ["#ffd000", "#00ff9d", "#ff2e88", "#ffffff"] });
      await refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "rekt — tx failed");
    } finally {
      setSubmitting(false);
    }
  }

  const hasWinnings = winningBalance !== undefined && winningBalance > 0n;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <HoloCard radius={20} innerClassName="p-5">
        <h2 className="font-bold text-gray-100 mb-2 uppercase tracking-wide">Claim ur bag</h2>
        <p className="text-sm text-gray-300 mb-4">
          Outcome: <strong>{market.outcome ? "UP 🟢" : "DOWN 🔴"}</strong>. Winning shares:{" "}
          {formatCollateral(winningBalance ?? 0n, COLLATERAL_DECIMALS)} {COLLATERAL_SYMBOL}
        </p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleRedeem}
          onPointerDown={onRedeemRipple}
          disabled={submitting || !hasWinnings}
          className="relative overflow-hidden rounded-xl bg-accent hover:bg-accent-dark text-gray-950 py-2.5 px-5 text-sm font-bold uppercase tracking-wide disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 glow-accent"
        >
          {redeemRippleLayer}
          {hasWinnings ? "Claim bag 🐒" : "Nothing to claim, ser"}
        </motion.button>
        {status && <p className="text-sm text-gray-400 mt-2">{status}</p>}
      </HoloCard>
    </motion.div>
  );
}
