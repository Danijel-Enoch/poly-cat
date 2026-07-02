"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract } from "@/lib/contracts";
import type { MarketState } from "@/lib/ponder";
import { formatDate } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { useClickRipple } from "@/components/ClickRipple";

export function SettleActions({
  marketId,
  closeTime,
  state,
}: {
  marketId: bigint;
  closeTime: bigint;
  state: MarketState;
}) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const now = useNow();
  const isClosed = now / 1000 >= Number(closeTime);
  const { onPointerDown: onYesRipple, rippleLayer: yesRippleLayer } = useClickRipple();
  const { onPointerDown: onNoRipple, rippleLayer: noRippleLayer } = useClickRipple();

  const { data: owner } = useReadContract({ ...marketFactoryContract, functionName: "owner" });
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  // Already-finalized markets have their outcome surfaced by RedeemButton instead.
  if (state === "Finalized") return null;

  async function handleSettle(outcome: boolean) {
    setSubmitting(true);
    setStatus(outcome ? "Settling YES..." : "Settling NO...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "settleMarket",
        args: [marketId, outcome],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Settled!");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-gray-100">Settlement</h2>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isClosed ? "unresolved" : "pending"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-800 text-gray-300"
          >
            Unresolved
          </motion.span>
        </AnimatePresence>
      </div>

      <p className="text-sm text-gray-400 mb-4">
        Settled directly by the platform admin — no bond, no dispute window, no oracle module.
      </p>

      {!isClosed ? (
        <p className="text-sm text-gray-400">Settlement opens after the market closes on {formatDate(closeTime)}.</p>
      ) : !isAdmin ? (
        <p className="text-sm text-gray-400">Waiting for the admin to settle this market.</p>
      ) : (
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={submitting}
            onClick={() => handleSettle(true)}
            onPointerDown={onYesRipple}
            className="relative overflow-hidden flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {yesRippleLayer}
            Settle YES
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={submitting}
            onClick={() => handleSettle(false)}
            onPointerDown={onNoRipple}
            className="relative overflow-hidden flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {noRippleLayer}
            Settle NO
          </motion.button>
        </div>
      )}

      {status && <p className="text-sm text-gray-400 mt-3">{status}</p>}
    </div>
  );
}
