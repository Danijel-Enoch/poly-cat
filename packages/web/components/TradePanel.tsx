"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useClickRipple } from "@/components/ClickRipple";
import { useAccount, useBalance, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { maxUint256 } from "viem";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, usdcContract, collateralDecimals, collateralSymbol, isNativeCollateral } from "@/lib/contracts";
import { formatCollateral, parseCollateral, isPartialDecimalInput, yesProbabilityFromSupplies } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { quoteBuy, quoteSell, quoteAmountInForShares, CurveQuoteError } from "@/lib/curveMath";

const MARKET_STATE_TRADING = 0;

export function TradePanel({ marketId }: { marketId: bigint }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const now = useNow();
  const { onPointerDown: onSubmitRipple, rippleLayer: submitRippleLayer } = useClickRipple();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  // "spend": amount is USDC to pay in; "receive": amount is the exact number of
  // outcome shares to end up with (the contract has no inverse-quote view, so the
  // required amountIn is solved for client-side — see lib/curveMath.ts).
  const [buyMode, setBuyMode] = useState<"spend" | "receive">("spend");
  const [isYes, setIsYes] = useState(true);
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: market, refetch: refetchMarket } = useReadContract({
    ...marketFactoryContract,
    functionName: "getMarket",
    args: [marketId],
  });

  const { data: feeBps } = useReadContract({
    ...marketFactoryContract,
    functionName: "feeBps",
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    ...usdcContract,
    functionName: "allowance",
    args: address ? [address, marketFactoryContract.address] : undefined,
    query: { enabled: !!address },
  });

  const { data: usdcBalance } = useReadContract({
    ...usdcContract,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: ethBalance } = useBalance({ address, query: { enabled: !!address } });

  const { data: yesBalance, refetch: refetchYes } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address ? [marketId, true, address] : undefined,
    query: { enabled: !!address },
  });

  const { data: noBalance, refetch: refetchNo } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address ? [marketId, false, address] : undefined,
    query: { enabled: !!address },
  });

  const sSame = market && isYes ? market.yesSupply : market?.noSupply;
  const sOther = market && isYes ? market.noSupply : market?.yesSupply;

  // Live quote preview — best-effort, purely for display. Reverts to null on any
  // input that the curve would reject (zero, dust, insufficient shares, etc).
  const preview = useMemo(() => {
    if (!market || feeBps === undefined || sSame === undefined || sOther === undefined) return null;
    const decimals = collateralDecimals(market.collateralToken);
    const symbol = collateralSymbol(market.collateralToken);
    const parsed = (() => {
      try {
        return parseCollateral(amount || "0", decimals);
      } catch {
        return 0n;
      }
    })();
    if (parsed <= 0n) return null;

    try {
      if (side === "buy" && buyMode === "spend") {
        const { sharesOut } = quoteBuy(market.reserve, sSame, sOther, parsed, BigInt(feeBps));
        return { label: "shares", value: sharesOut };
      }
      if (side === "buy" && buyMode === "receive") {
        const amountIn = quoteAmountInForShares(market.reserve, sSame, sOther, parsed, BigInt(feeBps));
        return { label: symbol, value: amountIn };
      }
      const { collateralOut } = quoteSell(market.reserve, sSame, sOther, parsed, BigInt(feeBps));
      return { label: symbol, value: collateralOut };
    } catch (err) {
      if (err instanceof CurveQuoteError) return null;
      throw err;
    }
  }, [market, feeBps, sSame, sOther, side, buyMode, amount]);

  if (!market) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
        Loading market...
      </div>
    );
  }

  const isTrading = market.state === MARKET_STATE_TRADING && now / 1000 < Number(market.closeTime);
  const isNative = isNativeCollateral(market.collateralToken);
  const decimals = collateralDecimals(market.collateralToken);
  const symbol = collateralSymbol(market.collateralToken);
  const collateralBalance = isNative ? (ethBalance?.value ?? 0n) : (usdcBalance ?? 0n);
  const yesProb = yesProbabilityFromSupplies(market.yesSupply, market.noSupply);
  const yesPct = Math.round(yesProb * 100);
  const shareBalance = isYes ? yesBalance : noBalance;
  const sideColor = isYes ? "emerald" : "rose";
  const reserve = market.reserve;

  async function refetchAll() {
    await Promise.all([refetchMarket(), refetchAllowance(), refetchYes(), refetchNo()]);
  }

  function addToAmount(n: number) {
    setAmount((prev) => (Math.max(0, Number(prev || "0") + n)).toString());
  }

  function setMax() {
    if (side === "sell") {
      setAmount(formatCollateral(shareBalance ?? 0n, decimals).replace(/,/g, ""));
      return;
    }
    if (buyMode === "receive" && sSame !== undefined && sOther !== undefined && feeBps !== undefined) {
      // Max shares affordable with the current balance.
      try {
        const { sharesOut } = quoteBuy(reserve, sSame, sOther, collateralBalance, BigInt(feeBps));
        setAmount(formatCollateral(sharesOut, decimals).replace(/,/g, ""));
        return;
      } catch {
        // fall through to the raw balance below if the quote can't be computed
      }
    }
    setAmount(formatCollateral(collateralBalance, decimals).replace(/,/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || sSame === undefined || sOther === undefined || feeBps === undefined) return;
    setSubmitting(true);
    setStatus(null);

    try {
      if (side === "buy") {
        const parsed = parseCollateral(amount, decimals);
        const amountIn = buyMode === "receive" ? quoteAmountInForShares(reserve, sSame, sOther, parsed, BigInt(feeBps)) : parsed;
        const minSharesOut = buyMode === "receive" ? parsed : 0n;

        if (!isNative && (!allowance || allowance < amountIn)) {
          // Approve once for (effectively) unlimited spending, matching how real USDC
          // treats a max-uint256 allowance: `_spendAllowance` skips decrementing it, so
          // this is the only approval a wallet ever needs to sign for this market.
          setStatus(`Approving ${symbol}...`);
          const approveHash = await writeContractAsync({
            ...usdcContract,
            functionName: "approve",
            args: [marketFactoryContract.address, maxUint256],
          });
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        }
        setStatus("Buying shares...");
        const hash = await writeContractAsync({
          ...marketFactoryContract,
          functionName: "buyShares",
          args: [marketId, isYes, amountIn, minSharesOut],
          value: isNative ? amountIn : 0n,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
      } else {
        const sharesIn = parseCollateral(amount, decimals);
        setStatus("Selling shares...");
        const hash = await writeContractAsync({
          ...marketFactoryContract,
          functionName: "sellShares",
          args: [marketId, isYes, sharesIn, 0n],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
      }
      setStatus("Done!");
      await refetchAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div className="relative flex items-center justify-between gap-1 mb-4">
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSide("buy")}
            className={`relative px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${side === "buy" ? "text-white" : "text-gray-400 hover:bg-gray-800"}`}
          >
            {side === "buy" && (
              <motion.span layoutId="trade-side-highlight" className="absolute inset-0 rounded-full bg-gray-700" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative">Buy</span>
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`relative px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${side === "sell" ? "text-white" : "text-gray-400 hover:bg-gray-800"}`}
          >
            {side === "sell" && (
              <motion.span layoutId="trade-side-highlight" className="absolute inset-0 rounded-full bg-gray-700" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative">Sell</span>
          </button>
        </div>
        {isConnected && (
          <span className="text-xs text-gray-500">
            Balance: <span className="text-gray-300 font-semibold">{formatCollateral(collateralBalance, decimals)} {symbol}</span>
          </span>
        )}
      </div>

      {!isTrading ? (
        <p className="text-sm text-gray-400">Trading is closed for this market.</p>
      ) : !isConnected ? (
        <p className="text-sm text-gray-400">Connect your wallet to trade.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              onClick={() => setIsYes(true)}
              whileTap={{ scale: 0.96 }}
              className={`rounded-xl py-3 font-bold text-sm transition-colors ${
                isYes
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900"
              }`}
            >
              Yes · {yesPct}¢
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setIsYes(false)}
              whileTap={{ scale: 0.96 }}
              className={`rounded-xl py-3 font-bold text-sm transition-colors ${
                !isYes
                  ? "bg-rose-600 text-white"
                  : "bg-rose-950 text-rose-400 border border-rose-900 hover:bg-rose-900"
              }`}
            >
              No · {100 - yesPct}¢
            </motion.button>
          </div>

          {side === "buy" && (
            <div className="flex items-center gap-1 -mb-2">
              <button
                type="button"
                onClick={() => setBuyMode("spend")}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  buyMode === "spend" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                Spend {symbol}
              </button>
              <button
                type="button"
                onClick={() => setBuyMode("receive")}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                  buyMode === "receive" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                Buy exact shares
              </button>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-400">
              {side === "sell" ? "Shares to sell" : buyMode === "receive" ? "Shares to buy" : `Amount (${symbol})`}
            </label>
            <div className="relative mt-1">
              {side === "buy" && buyMode === "spend" && !isNative && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-500">$</span>
              )}
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  if (isPartialDecimalInput(e.target.value)) setAmount(e.target.value);
                }}
                className={`w-full text-2xl font-bold text-gray-100 bg-transparent border-b-2 border-gray-700 focus:border-accent outline-none py-1 ${side === "buy" && buyMode === "spend" && !isNative ? "pl-5" : ""}`}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {preview
                ? preview.label === "shares"
                  ? `If ${isYes ? "Yes" : "No"} wins → you get ${formatCollateral(preview.value, decimals)} ${symbol}`
                  : `≈ ${formatCollateral(preview.value, decimals)} ${preview.label}`
                : side === "sell"
                  ? `Balance: ${formatCollateral(shareBalance ?? 0n, decimals)} shares`
                  : `Balance: ${formatCollateral(collateralBalance, decimals)} ${symbol}`}
            </p>
          </div>

          <div className="flex gap-2 text-xs font-semibold">
            {side === "buy" && buyMode === "spend" ? (
              <>
                {(isNative ? [0.01, 0.05, 0.1] : [10, 50, 100]).map((increment) => (
                  <button
                    key={increment}
                    type="button"
                    onClick={() => addToAmount(increment)}
                    className="flex-1 rounded-full border border-gray-700 text-gray-300 py-1.5 hover:bg-gray-800"
                  >
                    +{isNative ? increment : `$${increment}`}
                  </button>
                ))}
              </>
            ) : (
              <>
                <button type="button" onClick={() => addToAmount(1)} className="flex-1 rounded-full border border-gray-700 text-gray-300 py-1.5 hover:bg-gray-800">
                  +1
                </button>
                <button type="button" onClick={() => addToAmount(10)} className="flex-1 rounded-full border border-gray-700 text-gray-300 py-1.5 hover:bg-gray-800">
                  +10
                </button>
              </>
            )}
            <button type="button" onClick={setMax} className="flex-1 rounded-full border border-gray-700 text-gray-300 py-1.5 hover:bg-gray-800">
              Max
            </button>
          </div>

          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={{ scale: 0.98 }}
            onPointerDown={onSubmitRipple}
            className={`relative overflow-hidden rounded-xl py-3 font-bold text-white text-sm disabled:opacity-50 ${
              sideColor === "emerald" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            {submitRippleLayer}
            {submitting ? "Submitting..." : `${side === "buy" ? "Buy" : "Sell"} ${isYes ? "Yes" : "No"}`}
          </motion.button>
          {status && <p className="text-sm text-gray-400">{status}</p>}
        </form>
      )}

      {isConnected && (
        <div className="mt-5 pt-4 border-t border-gray-800 flex gap-3 text-xs">
          <span className="flex-1 rounded-lg bg-emerald-950 text-emerald-400 px-3 py-2 font-semibold">
            Yes: {formatCollateral(yesBalance ?? 0n, decimals)}
          </span>
          <span className="flex-1 rounded-lg bg-rose-950 text-rose-400 px-3 py-2 font-semibold">
            No: {formatCollateral(noBalance ?? 0n, decimals)}
          </span>
        </div>
      )}
    </div>
  );
}
