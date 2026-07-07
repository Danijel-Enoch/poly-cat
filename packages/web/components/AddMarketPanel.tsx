"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract } from "@/lib/contracts";
import { searchDexScreener, searchGatePairs, type DexScreenerResult, type GateResult } from "@/lib/assetSearchApi";

const PRICE_SOURCE_GATE = 0;
const PRICE_SOURCE_DEXSCREENER = 1;

/** Owner-only "add a market" flow: search either DexScreener (scoped to
 * Robinhood Chain pairs — memecoins) or Gate.com's tradable USDT pairs
 * ("blue chip" tokens), then register a result on-chain. Registering is the
 * entire "add market" action — `packages/cron` picks up any newly
 * registered asset on its next pass and opens its first 5-minute window. */
export function AddMarketPanel({ onRegistered }: { onRegistered: () => void }) {
  const [tab, setTab] = useState<"dexscreener" | "gate">("dexscreener");
  const [query, setQuery] = useState("");
  const [dexResults, setDexResults] = useState<DexScreenerResult[]>([]);
  const [gateResults, setGateResults] = useState<GateResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setStatus(null);
    try {
      if (tab === "dexscreener") {
        setDexResults(await searchDexScreener(query));
      } else {
        setGateResults(await searchGatePairs(query));
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleRegister(symbol: string, source: number, sourceId: string) {
    setRegisteringId(sourceId);
    setStatus(`Registering ${symbol}...`);
    try {
      const hash = await writeContractAsync({
        ...marketFactoryContract,
        functionName: "registerAsset",
        args: [symbol, source, sourceId],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      setStatus(`${symbol} registered — the cron script will open its first market on its next run.`);
      onRegistered();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegisteringId(null);
    }
  }

  const results = tab === "dexscreener" ? dexResults : gateResults;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <h2 className="font-bold text-gray-100 mb-3">Add market</h2>

      <div className="flex items-center gap-1 mb-3">
        <button
          type="button"
          onClick={() => setTab("dexscreener")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === "dexscreener" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"}`}
        >
          DexScreener (Robinhood Chain)
        </button>
        <button
          type="button"
          onClick={() => setTab("gate")}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold ${tab === "gate" ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800"}`}
        >
          Gate.com
        </button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "dexscreener" ? "Search token name or symbol..." : "Search symbol (e.g. BTC)..."}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {tab === "dexscreener"
          ? dexResults.map((r) => (
              <div
                key={r.pairAddress}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-100 truncate">
                    {r.symbol} <span className="text-gray-500 font-normal">· {r.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.priceUsd ? `$${r.priceUsd}` : "—"}
                    {r.liquidityUsd ? ` · $${Math.round(r.liquidityUsd).toLocaleString()} liquidity` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={registeringId === r.pairAddress}
                  onClick={() => handleRegister(r.symbol, PRICE_SOURCE_DEXSCREENER, r.pairAddress)}
                  className="shrink-0 rounded-lg bg-accent hover:bg-accent-dark text-gray-950 text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                >
                  Register
                </button>
              </div>
            ))
          : gateResults.map((r) => (
              <div
                key={r.currencyPair}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950/40 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-100 truncate">
                    {r.symbol} <span className="text-gray-500 font-normal">· {r.name}</span>
                  </p>
                  <p className="text-xs text-gray-500">{r.currencyPair}</p>
                </div>
                <button
                  type="button"
                  disabled={registeringId === r.currencyPair}
                  onClick={() => handleRegister(r.symbol, PRICE_SOURCE_GATE, r.currencyPair)}
                  className="shrink-0 rounded-lg bg-accent hover:bg-accent-dark text-gray-950 text-xs font-semibold px-3 py-1.5 disabled:opacity-50"
                >
                  Register
                </button>
              </div>
            ))}
        {results.length === 0 && !searching && <p className="text-sm text-gray-500">Search to see results.</p>}
      </div>

      {status && <p className="text-sm text-gray-400 mt-3">{status}</p>}
    </div>
  );
}
