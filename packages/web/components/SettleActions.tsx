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
  const [newCloseDate, setNewCloseDate] = useState("");
  const now = useNow();
  const isClosed = now / 1000 >= Number(closeTime);
  const { onPointerDown: onYesRipple, rippleLayer: yesRippleLayer } = useClickRipple();
  const { onPointerDown: onNoRipple, rippleLayer: noRippleLayer } = useClickRipple();

  const { data: owner } = useReadContract({ ...marketFactoryContract, functionName: "owner" });
  const isAdmin = !!address && !!owner && address.toLowerCase() === owner.toLowerCase();

  // Finalized/cancelled markets have their outcome or refund surfaced by
  // RedeemButton/ClaimRefundButton instead.
  if (state === "Finalized" || state === "Cancelled") return null;

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

  async function handleExtend() {
    if (!newCloseDate) return;
    setSubmitting(true);
    setStatus("Extending close time...");
    try {
      const newCloseTime = BigInt(Math.floor(new Date(newCloseDate).getTime() / 1000));
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "extendCloseTime",
        args: [marketId, newCloseTime],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Close time extended!");
      setNewCloseDate("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setSubmitting(true);
    setStatus("Cancelling market...");
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "cancelMarket",
        args: [marketId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus("Market cancelled — traders can now claim a pro-rata refund.");
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
        Settled by an AI agent (LLM) — no bond, no dispute window, no oracle module.
      </p>

      {!isClosed ? (
        <p className="text-sm text-gray-400">Settlement opens after the market closes on {formatDate(closeTime)}.</p>
      ) : !isAdmin ? (
        <p className="text-sm text-gray-400">Waiting for the settlement agent to settle this market.</p>
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

      {isAdmin && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Admin: unsettled-market escape hatch
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="datetime-local"
              value={newCloseDate}
              onChange={(e) => setNewCloseDate(e.target.value)}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            />
            <button
              type="button"
              disabled={submitting || !newCloseDate}
              onClick={handleExtend}
              className="rounded-xl border border-gray-700 text-gray-200 hover:bg-gray-800 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Extend deadline
            </button>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleCancel}
            className="mt-2 w-full rounded-xl border border-rose-900 text-rose-400 hover:bg-rose-950 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Cancel market &amp; enable refunds
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Cancelling is permanent — traders get a pro-rata share of the pool back based on the shares they hold,
            not a full refund.
          </p>
        </div>
      )}
    </div>
  );
}
