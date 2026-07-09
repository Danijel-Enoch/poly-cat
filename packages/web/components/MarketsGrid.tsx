"use client";

import { useMemo, useState } from "react";
import type { IndexerAssetSlot } from "@/lib/indexerApi";
import { assetDisplayName } from "@/lib/assets";
import { MarketCard } from "@/components/MarketCard";

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Client-side filter over the already-fetched (server-rendered) slot list —
 * every market for every visible asset is loaded up front, so search never
 * needs its own round trip, just a substring match against the symbol and
 * display name. */
export function MarketsGrid({ slots }: { slots: IndexerAssetSlot[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return slots;
    return slots.filter((slot) => {
      const symbol = slot.asset.symbol.toLowerCase();
      const name = assetDisplayName(slot.asset.symbol).toLowerCase();
      return symbol.includes(q) || name.includes(q);
    });
  }, [slots, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative max-w-xs">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets..."
          aria-label="Search markets by asset"
          className="w-full rounded-full border border-border bg-card pl-9 pr-4 py-2 text-sm outline-none focus:border-foreground/40 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No markets match &quot;{query}&quot;.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((slot, index) => (
            <MarketCard key={slot.asset.id.toString()} slot={slot} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
