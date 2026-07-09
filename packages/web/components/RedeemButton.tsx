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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    setStatus("Claiming...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "redeem",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Claimed.");
      // hasWinnings gates this button, so a successful redeem here always means a
      // real payout — this is the "you won" moment worth celebrating.
      confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ["#3f7a52", "#1f1a10", "#ffffff"] });
      await refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  const hasWinnings = winningBalance !== undefined && winningBalance > 0n;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card>
        <CardContent>
          <h2 className="font-display text-lg mb-2">Claim your winnings</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Outcome: <strong className="text-foreground">{market.outcome ? "Up" : "Down"}</strong>. Winning shares:{" "}
            {formatCollateral(winningBalance ?? 0n, COLLATERAL_DECIMALS)} {COLLATERAL_SYMBOL}
          </p>
          <Button disabled={submitting || !hasWinnings} onClick={handleRedeem} onPointerDown={onRedeemRipple} className="relative overflow-hidden">
            {redeemRippleLayer}
            {hasWinnings ? "Claim winnings" : "Nothing to claim"}
          </Button>
          {status && <p className="text-sm text-muted-foreground mt-2">{status}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
