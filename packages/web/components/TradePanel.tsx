"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useClickRipple } from "@/components/ClickRipple";
import { useAccount, useBalance, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract, COLLATERAL_DECIMALS, COLLATERAL_SYMBOL } from "@/lib/contracts";
import { formatCollateral, parseCollateral, isPartialDecimalInput, upProbabilityFromSupplies } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { quoteBuy, quoteSell, quoteAmountInForShares, CurveQuoteError } from "@/lib/curveMath";

const MARKET_STATE_TRADING = 0;

export function TradePanel({ marketId }: { marketId: bigint }) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const now = useNow();
  const { onPointerDown: onSubmitRipple, rippleLayer: submitRippleLayer } = useClickRipple();

  const [side, setSide] = useState<"buy" | "sell">("buy");
  // "spend": amount is ETH to pay in; "receive": amount is the exact number of
  // outcome shares to end up with (the contract has no inverse-quote view, so the
  // required amountIn is solved for client-side — see lib/curveMath.ts).
  const [buyMode, setBuyMode] = useState<"spend" | "receive">("spend");
  const [isUp, setIsUp] = useState(true);
  const [amount, setAmount] = useState("0.1");
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

  // The minimum ETH a trader must buy in with — the same value the cron seeds
  // every new market's curve with (createMarket sends exactly `defaultInitialLiquidity`).
  // Enforced here as a UI floor; the contract itself only requires amountIn > 0.
  const { data: defaultInitialLiquidity } = useReadContract({
    ...marketFactoryContract,
    functionName: "defaultInitialLiquidity",
  });
  const minBuyIn = defaultInitialLiquidity;

  const { data: ethBalanceData, refetch: refetchEthBalance } = useBalance({
    address,
    query: { enabled: !!address },
  });
  const ethBalance = ethBalanceData?.value;

  const { data: upBalance, refetch: refetchUp } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address ? [marketId, true, address] : undefined,
    query: { enabled: !!address },
  });

  const { data: downBalance, refetch: refetchDown } = useReadContract({
    ...marketFactoryContract,
    functionName: "shareBalanceOf",
    args: address ? [marketId, false, address] : undefined,
    query: { enabled: !!address },
  });

  const sSame = market && isUp ? market.upSupply : market?.downSupply;
  const sOther = market && isUp ? market.downSupply : market?.upSupply;

  // Live quote preview — best-effort, purely for display. Reverts to null on any
  // input that the curve would reject (zero, dust, insufficient shares, etc).
  const preview = useMemo(() => {
    if (!market || feeBps === undefined || sSame === undefined || sOther === undefined) return null;
    const parsed = (() => {
      try {
        return parseCollateral(amount || "0", COLLATERAL_DECIMALS);
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
        return { label: COLLATERAL_SYMBOL, value: amountIn };
      }
      const { collateralOut } = quoteSell(market.reserve, sSame, sOther, parsed, BigInt(feeBps));
      return { label: COLLATERAL_SYMBOL, value: collateralOut };
    } catch (err) {
      if (err instanceof CurveQuoteError) return null;
      throw err;
    }
  }, [market, feeBps, sSame, sOther, side, buyMode, amount]);

  // Default the buy-in to the contract's `defaultInitialLiquidity` the first time
  // it resolves, so the panel opens with a valid (at-the-floor) amount rather than
  // the stale hardcoded "0.1". Seeded once per mount — never clobbers user typing.
  const seededAmount = useRef(false);
  useEffect(() => {
    if (seededAmount.current || minBuyIn === undefined || minBuyIn <= 0n) return;
    setAmount(formatCollateral(minBuyIn, COLLATERAL_DECIMALS).replace(/,/g, ""));
    seededAmount.current = true;
  }, [minBuyIn]);

  // The ETH actually being spent on a buy, resolved for both modes (in "receive"
  // mode the user types a share target, so the amountIn is solved for here).
  // Used to enforce the `defaultInitialLiquidity` floor on the resolved ETH, not
  // just the typed figure.
  const buyAmountIn = useMemo(() => {
    if (side !== "buy" || !market || feeBps === undefined || sSame === undefined || sOther === undefined) return undefined;
    const parsed = (() => {
      try {
        return parseCollateral(amount || "0", COLLATERAL_DECIMALS);
      } catch {
        return 0n;
      }
    })();
    if (parsed <= 0n) return 0n;
    try {
      return buyMode === "receive"
        ? quoteAmountInForShares(market.reserve, sSame, sOther, parsed, BigInt(feeBps))
        : parsed;
    } catch (err) {
      if (err instanceof CurveQuoteError) return undefined;
      throw err;
    }
  }, [side, buyMode, market, feeBps, sSame, sOther, amount]);

  const minBuyInEth = minBuyIn !== undefined ? formatCollateral(minBuyIn, COLLATERAL_DECIMALS) : null;
  const belowMin =
    side === "buy" && minBuyIn !== undefined && (buyAmountIn === undefined || buyAmountIn < minBuyIn);

  if (!market) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5 text-sm text-gray-400">
        Loading market...
      </div>
    );
  }

  // `market` only ever becomes defined client-side (wagmi's useReadContract has
  // no SSR data, and the early-return above covers the undefined case), so by
  // the time this line runs `now` has always resolved past its post-mount null
  // — the `=== null` case here is just to satisfy the type, not a real state.
  const isTrading = market.state === MARKET_STATE_TRADING && now !== null && now / 1000 < Number(market.closeTime);
  const upProb = upProbabilityFromSupplies(market.upSupply, market.downSupply);
  const upPct = Math.round(upProb * 100);
  const shareBalance = isUp ? upBalance : downBalance;
  const sideColor = isUp ? "emerald" : "rose";
  const reserve = market.reserve;

  async function refetchAll() {
    await Promise.all([refetchMarket(), refetchEthBalance(), refetchUp(), refetchDown()]);
  }

  function addToAmount(n: number) {
    setAmount((prev) => Math.max(0, Number(prev || "0") + n).toString());
  }

  function setMax() {
    if (side === "sell") {
      setAmount(formatCollateral(shareBalance ?? 0n, COLLATERAL_DECIMALS).replace(/,/g, ""));
      return;
    }
    if (buyMode === "receive" && sSame !== undefined && sOther !== undefined && feeBps !== undefined) {
      // Max shares affordable with the current balance.
      try {
        const { sharesOut } = quoteBuy(reserve, sSame, sOther, ethBalance ?? 0n, BigInt(feeBps));
        setAmount(formatCollateral(sharesOut, COLLATERAL_DECIMALS).replace(/,/g, ""));
        return;
      } catch {
        // fall through to the raw balance below if the quote can't be computed
      }
    }
    setAmount(formatCollateral(ethBalance ?? 0n, COLLATERAL_DECIMALS).replace(/,/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address || sSame === undefined || sOther === undefined || feeBps === undefined) return;
    setSubmitting(true);
    setStatus(null);

    try {
      if (side === "buy") {
        const parsed = parseCollateral(amount, COLLATERAL_DECIMALS);
        const amountIn =
          buyMode === "receive" ? quoteAmountInForShares(reserve, sSame, sOther, parsed, BigInt(feeBps)) : parsed;
        // Floor the buy-in at `defaultInitialLiquidity` — the contract itself only
        // requires amountIn > 0, so this UI-level guard is what actually enforces it.
        if (minBuyIn !== undefined && amountIn < minBuyIn) {
          setStatus(`Min ape-in is ${formatCollateral(minBuyIn, COLLATERAL_DECIMALS)} ${COLLATERAL_SYMBOL}, ser.`);
          return;
        }
        const minSharesOut = buyMode === "receive" ? parsed : 0n;

        setStatus("Aping in...");
        const hash = await writeContractAsync({
          ...marketFactoryContract,
          functionName: "buyShares",
          args: [marketId, isUp, minSharesOut],
          value: amountIn,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
      } else {
        const sharesIn = parseCollateral(amount, COLLATERAL_DECIMALS);
        setStatus("Exiting position...");
        const hash = await writeContractAsync({
          ...marketFactoryContract,
          functionName: "sellShares",
          args: [marketId, isUp, sharesIn, 0n],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash });
      }
      setStatus("WAGMI 🐒");
      await refetchAll();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "rekt — tx failed");
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
            className={`relative px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${side === "buy" ? "text-white" : "text-gray-400 hover:bg-gray-800"}`}
          >
            {side === "buy" && (
              <motion.span layoutId="trade-side-highlight" className="absolute inset-0 rounded-full bg-gray-700" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative">Ape</span>
          </button>
          <button
            type="button"
            onClick={() => setSide("sell")}
            className={`relative px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${side === "sell" ? "text-white" : "text-gray-400 hover:bg-gray-800"}`}
          >
            {side === "sell" && (
              <motion.span layoutId="trade-side-highlight" className="absolute inset-0 rounded-full bg-gray-700" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            <span className="relative">Exit</span>
          </button>
        </div>
        {isConnected && (
          <span className="text-xs text-gray-500">
            Bag:{" "}
            <span className="text-gray-300 font-bold">
              {formatCollateral(ethBalance ?? 0n, COLLATERAL_DECIMALS)} {COLLATERAL_SYMBOL}
            </span>
          </span>
        )}
      </div>

      {!isTrading ? (
        <p className="text-sm text-gray-400">Window&apos;s closed, ser — too late to ape this one.</p>
      ) : !isConnected ? (
        <p className="text-sm text-gray-400">Connect ur wallet to ape, fren.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              onClick={() => setIsUp(true)}
              whileTap={{ scale: 0.96 }}
              className={`rounded-xl py-3 font-bold text-sm uppercase tracking-wide transition-[box-shadow,background-color] ${
                isUp
                  ? "bg-emerald-500 text-gray-950 glow-up"
                  : "bg-emerald-950 text-emerald-400 border border-emerald-900 hover:bg-emerald-900"
              }`}
            >
              Ape Up · {upPct}¢
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setIsUp(false)}
              whileTap={{ scale: 0.96 }}
              className={`rounded-xl py-3 font-bold text-sm uppercase tracking-wide transition-[box-shadow,background-color] ${
                !isUp
                  ? "bg-rose-500 text-gray-950 glow-down"
                  : "bg-rose-950 text-rose-400 border border-rose-900 hover:bg-rose-900"
              }`}
            >
              Ape Dn · {100 - upPct}¢
            </motion.button>
          </div>

          {side === "buy" && (
            <div className="flex items-center gap-1 -mb-2">
              <button
                type="button"
                onClick={() => setBuyMode("spend")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                  buyMode === "spend" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                Send {COLLATERAL_SYMBOL}
              </button>
              <button
                type="button"
                onClick={() => setBuyMode("receive")}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                  buyMode === "receive" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                Exact shares
              </button>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-400">
              {side === "sell" ? "Shares to sell" : buyMode === "receive" ? "Shares to buy" : `Amount (${COLLATERAL_SYMBOL})`}
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  if (isPartialDecimalInput(e.target.value)) setAmount(e.target.value);
                }}
                className="w-full text-2xl font-bold text-gray-100 bg-transparent border-b-2 border-gray-700 focus:border-accent outline-none py-1"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {side === "buy" && belowMin && minBuyInEth
                ? <span className="text-amber-400">Min ape-in is {minBuyInEth} {COLLATERAL_SYMBOL}</span>
                : preview
                  ? preview.label === "shares"
                    ? `If ${isUp ? "Up" : "Down"} wins → bag ${formatCollateral(preview.value, COLLATERAL_DECIMALS)} ${COLLATERAL_SYMBOL}`
                    : `≈ ${formatCollateral(preview.value, COLLATERAL_DECIMALS)} ${preview.label}`
                  : side === "sell"
                    ? `Bag: ${formatCollateral(shareBalance ?? 0n, COLLATERAL_DECIMALS)} shares`
                    : `Bag: ${formatCollateral(ethBalance ?? 0n, COLLATERAL_DECIMALS)} ${COLLATERAL_SYMBOL}`}
            </p>
          </div>

          <div className="flex gap-2 text-xs font-semibold">
            {side === "buy" && buyMode === "spend" ? (
              <>
                {[0.01, 0.05, 0.1].map((increment) => (
                  <button
                    key={increment}
                    type="button"
                    onClick={() => addToAmount(increment)}
                    className="flex-1 rounded-full border border-gray-700 text-gray-300 py-1.5 hover:bg-gray-800"
                  >
                    +{increment}
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
            disabled={submitting || belowMin}
            whileTap={{ scale: 0.98 }}
            onPointerDown={onSubmitRipple}
            className={`relative overflow-hidden rounded-xl py-3 font-bold text-gray-950 text-sm uppercase tracking-wide disabled:opacity-50 ${
              sideColor === "emerald" ? "bg-emerald-500 hover:bg-emerald-400 glow-up" : "bg-rose-500 hover:bg-rose-400 glow-down"
            }`}
          >
            {submitRippleLayer}
            {submitting
              ? "Sending it..."
              : side === "buy"
                ? `Ape ${isUp ? "Up 🟢" : "Down 🔴"}`
                : `Exit ${isUp ? "Up" : "Down"}`}
          </motion.button>
          {status && <p className="text-sm text-gray-400">{status}</p>}
        </form>
      )}

      {isConnected && (
        <div className="mt-5 pt-4 border-t border-gray-800 flex gap-3 text-xs">
          <span className="flex-1 rounded-lg bg-emerald-950 text-emerald-400 px-3 py-2 font-bold uppercase tracking-wide">
            Up bag: {formatCollateral(upBalance ?? 0n, COLLATERAL_DECIMALS)}
          </span>
          <span className="flex-1 rounded-lg bg-rose-950 text-rose-400 px-3 py-2 font-bold uppercase tracking-wide">
            Dn bag: {formatCollateral(downBalance ?? 0n, COLLATERAL_DECIMALS)}
          </span>
        </div>
      )}
    </div>
  );
}
