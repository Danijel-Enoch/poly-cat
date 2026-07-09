"use client";

import { useState } from "react";
import { useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { wagmiConfig } from "@/lib/wagmi";
import { marketFactoryContract } from "@/lib/contracts";
import { searchDexScreener, searchGatePairs, type DexScreenerResult, type GateResult } from "@/lib/assetSearchApi";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <Card>
      <CardHeader>
        <CardTitle>Add market</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-1 mb-3">
          <button
            type="button"
            onClick={() => setTab("dexscreener")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${tab === "dexscreener" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            DexScreener (Robinhood Chain)
          </button>
          <button
            type="button"
            onClick={() => setTab("gate")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${tab === "gate" ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-accent"}`}
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
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          {tab === "dexscreener"
            ? dexResults.map((r) => (
                <div key={r.pairAddress} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.symbol} <span className="text-muted-foreground font-normal">· {r.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.priceUsd ? `$${r.priceUsd}` : "—"}
                      {r.liquidityUsd ? ` · $${Math.round(r.liquidityUsd).toLocaleString()} liquidity` : ""}
                    </p>
                  </div>
                  <Button size="sm" disabled={registeringId === r.pairAddress} onClick={() => handleRegister(r.symbol, PRICE_SOURCE_DEXSCREENER, r.pairAddress)}>
                    Register
                  </Button>
                </div>
              ))
            : gateResults.map((r) => (
                <div key={r.currencyPair} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.symbol} <span className="text-muted-foreground font-normal">· {r.name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{r.currencyPair}</p>
                  </div>
                  <Button size="sm" disabled={registeringId === r.currencyPair} onClick={() => handleRegister(r.symbol, PRICE_SOURCE_GATE, r.currencyPair)}>
                    Register
                  </Button>
                </div>
              ))}
          {results.length === 0 && !searching && <p className="text-sm text-muted-foreground">Search to see results.</p>}
        </div>

        {status && <p className="text-sm text-muted-foreground mt-3">{status}</p>}
      </CardContent>
    </Card>
  );
}
