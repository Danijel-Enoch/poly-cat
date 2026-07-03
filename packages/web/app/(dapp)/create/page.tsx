"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { keccak256, maxUint256, toHex } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, usdcContract, USDC_ADDRESS, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatUsdc, parseUsdc } from "@/lib/format";
import { CATEGORIES, encodeMetadataURI, type Category } from "@/lib/category";
import { useClickRipple } from "@/components/ClickRipple";

export default function CreateMarketPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { onPointerDown: onSubmitRipple, rippleLayer: submitRippleLayer } = useClickRipple();

  const [question, setQuestion] = useState("");
  const [category, setCategory] = useState<Category>("Politics");
  const [closeDate, setCloseDate] = useState("");
  const [liquidity, setLiquidity] = useState("100");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: allowance } = useReadContract({
    ...usdcContract,
    functionName: "allowance",
    args: address ? [address, marketFactoryContract.address] : undefined,
    query: { enabled: !!address },
  });

  const { data: protocolFeeBps } = useReadContract({
    ...marketFactoryContract,
    functionName: "feeBps",
  });

  const { data: usdcBalance } = useReadContract({
    ...usdcContract,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
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
        // Approve once for (effectively) unlimited spending — see TradePanel for why
        // a max-uint256 allowance means this is the only approval ever needed.
        setStatus(`Approving ${COLLATERAL_SYMBOL}...`);
        const approveHash = await writeContractAsync({
          ...usdcContract,
          functionName: "approve",
          args: [marketFactoryContract.address, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }

      setStatus("Creating market...");
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "createMarket",
        args: [
          {
            collateralToken: USDC_ADDRESS,
            questionHash: keccak256(toHex(question)),
            metadataURI: encodeMetadataURI(category, question),
            closeTime,
            initialLiquidity,
          },
        ],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      setStatus("Market created!");
      router.push("/app");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-extrabold text-gray-100 mb-1">Create a market</h1>
      <p className="text-sm text-gray-400 mb-4">Ask any yes/no question. Anyone can trade once it&apos;s live.</p>

      <div className="mb-6 rounded-2xl border border-amber-900/50 bg-amber-950/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2">Before you create a market</p>
        <ul className="text-xs text-amber-200/80 space-y-1.5 list-disc list-inside">
          <li>
            Your initial liquidity seeds the market&apos;s bonding curve and isn&apos;t returned to you — you only earn
            it back over time via your 5% cut of trading fees, and only if people actually trade.
          </li>
          <li>
            Settlement is handled by an AI agent (LLM): it decides the outcome once trading closes.
            There is no bond, no dispute process, and no oracle — a wrong or malicious settlement is possible.
          </li>
          <li>Only seed a market you&apos;re comfortable funding and confident can be settled fairly.</li>
        </ul>
      </div>

      {!isConnected ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
          <p className="text-gray-400 text-sm">Connect your wallet to create a market.</p>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          Question
          <input
            required
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Will it rain in NYC tomorrow?"
            className="rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          Closes at
          <input
            required
            type="datetime-local"
            value={closeDate}
            onChange={(e) => setCloseDate(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-300">
          <span className="flex items-center justify-between">
            Initial liquidity ({COLLATERAL_SYMBOL})
            <span className="text-xs font-normal text-gray-500">
              Balance: {formatUsdc(usdcBalance ?? 0n)} {COLLATERAL_SYMBOL}
            </span>
          </span>
          <input
            required
            type="number"
            min="1"
            step="0.01"
            value={liquidity}
            onChange={(e) => setLiquidity(e.target.value)}
            className="rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </label>
        <p className="text-xs text-gray-500">
          Markets are settled by an AI agent (LLM) once trading closes — no bond, no dispute, no oracle.
          A protocol trading fee of {((protocolFeeBps ?? 100) / 100).toFixed(2)}% applies to every buy and sell, set
          by the platform admin — not configurable per market. As the creator, you earn 5% of that fee on every trade
          in your market, withdrawable any time from the market page.
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
        {status && <p className="text-sm text-gray-400">{status}</p>}
      </form>
      )}
    </div>
  );
}
