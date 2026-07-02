"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { keccak256, toHex } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, mockUsdcContract, MOCK_USDC_ADDRESS } from "@/lib/contracts";
import { parseUsdc } from "@/lib/format";
import { CATEGORIES, encodeMetadataURI, type Category } from "@/lib/category";
import { useClickRipple } from "@/components/ClickRipple";

export default function CreateMarketPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { onPointerDown: onSubmitRipple, rippleLayer: submitRippleLayer } = useClickRipple();

  const [question, setQuestion] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [category, setCategory] = useState<Category>("Politics");
  const [closeDate, setCloseDate] = useState("");
  const [liquidity, setLiquidity] = useState("100");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: allowance } = useReadContract({
    ...mockUsdcContract,
    functionName: "allowance",
    args: address ? [address, marketFactoryContract.address] : undefined,
    query: { enabled: !!address },
  });

  const { data: protocolFeeBps } = useReadContract({
    ...marketFactoryContract,
    functionName: "feeBps",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setSubmitting(true);
    setStatus(null);

    try {
      const initialLiquidity = parseUsdc(liquidity);
      const closeTime = BigInt(Math.floor(new Date(closeDate).getTime() / 1000));

      if (!allowance || allowance < initialLiquidity) {
        setStatus("Approving USDC...");
        const approveHash = await writeContractAsync({
          ...mockUsdcContract,
          functionName: "approve",
          args: [marketFactoryContract.address, initialLiquidity],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      setStatus("Creating market...");
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "createMarket",
        args: [
          {
            collateralToken: MOCK_USDC_ADDRESS,
            questionHash: keccak256(toHex(question)),
            metadataURI: encodeMetadataURI(category, metadataURI || question),
            closeTime,
            initialLiquidity,
          },
        ],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      setStatus("Market created!");
      router.push("/");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400 text-sm">Connect your wallet to create a market.</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-1">Create a market</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Ask any yes/no question. Anyone can trade once it&apos;s live.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Question
          <input
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will it rain in NYC tomorrow?"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Metadata / resolution criteria URI (optional)
          <input
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="ipfs://... or leave blank to reuse the question text"
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Closes at
          <input
            required
            type="datetime-local"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
          Initial liquidity (USDC)
          <input
            required
            type="number"
            min="1"
            step="0.01"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Markets are settled directly by the platform admin once trading closes — no bond, no dispute, no oracle.
          A protocol trading fee of {((protocolFeeBps ?? 100) / 100).toFixed(2)}% applies to every buy and sell,
          set by the platform admin — not configurable per market.
        </p>

        <motion.button
          type="submit"
          disabled={submitting}
          whileTap={{ scale: 0.98 }}
          onPointerDown={onSubmitRipple}
          className="relative overflow-hidden mt-2 rounded-full bg-accent hover:bg-accent-dark text-gray-900 py-2.5 font-semibold disabled:opacity-50"
        >
          {submitRippleLayer}
          {submitting ? "Submitting..." : "Create market"}
        </motion.button>
        {status && <p className="text-sm text-gray-500 dark:text-gray-400">{status}</p>}
      </form>
    </div>
  );
}
