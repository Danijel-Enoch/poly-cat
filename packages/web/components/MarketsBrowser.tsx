"use client";

import { useMemo, useState } from "react";
import type { MarketRow } from "@/lib/ponder";
import { CATEGORIES, parseMetadataURI, type Category } from "@/lib/category";
import { MarketCard } from "@/components/MarketCard";
import { useClickRipple } from "@/components/ClickRipple";

type CategoryPill = "All" | Category;
type SortBy = "Trending" | "Newest" | "ClosingSoon" | "RecentlyResolved";
type Status = "All" | "Open" | "Resolved";

const CATEGORY_PILLS: CategoryPill[] = ["All", ...CATEGORIES.filter((c) => c !== "Other")];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "Trending", label: "Trending" },
  { value: "Newest", label: "Newest" },
  { value: "ClosingSoon", label: "Closing soon" },
  { value: "RecentlyResolved", label: "Recently resolved" },
];

const STATUS_OPTIONS: Status[] = ["All", "Open", "Resolved"];

function PillButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { onPointerDown, rippleLayer } = useClickRipple();
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`relative overflow-hidden shrink-0 text-sm font-medium px-3.5 py-1.5 rounded-full transition-colors ${
        active ? "bg-accent text-gray-900" : "bg-gray-900 text-gray-300 hover:bg-gray-800"
      }`}
    >
      {rippleLayer}
      {label}
    </button>
  );
}

export function MarketsBrowser({ markets, verifiedIds = [] }: { markets: MarketRow[]; verifiedIds?: string[] }) {
  const verifiedSet = useMemo(() => new Set(verifiedIds), [verifiedIds]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryPill>("All");
  const [sortBy, setSortBy] = useState<SortBy>("Trending");
  const [status, setStatus] = useState<Status>("All");

  function handleSortChange(next: SortBy) {
    setSortBy(next);
    // These two sorts only make sense within one status — keep the controls in sync
    // rather than showing a confusing empty/mixed list.
    if (next === "ClosingSoon") setStatus("Open");
    if (next === "RecentlyResolved") setStatus("Resolved");
  }

  const displayed = useMemo(() => {
    let list = markets;

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((m) => parseMetadataURI(m.metadataURI).title.toLowerCase().includes(query));
    }

    if (category !== "All") {
      list = list.filter((m) => parseMetadataURI(m.metadataURI).category === category);
    }

    if (status === "Open") {
      list = list.filter((m) => m.state === "Trading");
    } else if (status === "Resolved") {
      list = list.filter((m) => m.state === "Finalized");
    }

    list = [...list];
    switch (sortBy) {
      case "Trending":
        list.sort((a, b) => (BigInt(a.volume) < BigInt(b.volume) ? 1 : -1));
        break;
      case "Newest":
        list.sort((a, b) => (BigInt(a.createdAt) < BigInt(b.createdAt) ? 1 : -1));
        break;
      case "ClosingSoon":
        list.sort((a, b) => (BigInt(a.closeTime) > BigInt(b.closeTime) ? 1 : -1));
        break;
      case "RecentlyResolved":
        list.sort((a, b) => (BigInt(a.settledAt ?? "0") < BigInt(b.settledAt ?? "0") ? 1 : -1));
        break;
    }
    return list;
  }, [markets, search, category, status, sortBy]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search markets..."
          className="w-full sm:max-w-xs rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
        <select
          value={sortBy}
          onChange={(e) => handleSortChange(e.target.value as SortBy)}
          className="rounded-lg border border-gray-700 bg-gray-900 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_OPTIONS.map((s) => (
            <PillButton key={s} label={s} active={status === s} onClick={() => setStatus(s)} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORY_PILLS.map((label) => (
          <PillButton key={label} label={label} active={category === label} onClick={() => setCategory(label)} />
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-900 py-16 text-center">
          <p className="text-gray-400 text-sm">No markets match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayed.map((market, index) => (
            <MarketCard key={market.id} market={market} index={index} verified={verifiedSet.has(market.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
