"use client";

import { useState } from "react";
import { useSignMessage } from "wagmi";
import { researchMessage } from "@/lib/adminResearchMessage";
import { currentTimestamp } from "@/lib/adminVerifyMessage";
import type { MarketOutcome, MarketResearchResult } from "@/lib/openrouter";

const OUTCOME_STYLE: Record<MarketOutcome, string> = {
  YES: "bg-emerald-950 text-emerald-400 border-emerald-900",
  NO: "bg-rose-950 text-rose-400 border-rose-900",
  UNCLEAR: "bg-amber-950 text-amber-400 border-amber-900",
};

/** Admin-only "settlement research assistant" — asks an OpenRouter model
 * (grounded with a Polymarket lookup and its own web-search plugin, see
 * lib/openrouter.ts) what actually happened, so the admin has a documented
 * recommendation + sources to check before clicking Settle YES/NO
 * themselves. Never calls settleMarket itself — see admin/page.tsx, which
 * keeps that an explicit, separate, human action. */
export function MarketResearchPanel({ marketId }: { marketId: string }) {
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarketResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResearch() {
    setLoading(true);
    setError(null);
    try {
      const timestamp = currentTimestamp();
      const message = researchMessage(marketId, timestamp);
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/admin/research-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, timestamp, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-800">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={handleResearch}
          className="rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800 text-xs font-semibold px-3 py-1.5 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Researching..." : "Research with AI"}
        </button>
        {result && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${OUTCOME_STYLE[result.outcome]}`}>
            Suggests {result.outcome} · {result.confidence}% confident
          </span>
        )}
      </div>

      {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}

      {result && (
        <div className="mt-2 rounded-lg bg-gray-950/60 border border-gray-800 p-3">
          <p className="text-xs text-gray-300">{result.reasoning}</p>
          {result.matchedPolymarketUrl && (
            <a
              href={result.matchedPolymarketUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-[11px] text-accent hover:underline mt-2"
            >
              Matched Polymarket market ↗
            </a>
          )}
          {result.sources.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {result.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-gray-400 hover:text-gray-200 hover:underline truncate block"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-gray-500 mt-2">
            AI-generated research — verify before settling. This does not settle the market.
          </p>
        </div>
      )}
    </div>
  );
}
