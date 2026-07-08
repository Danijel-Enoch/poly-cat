"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assetColor, knownAssetIconUrl } from "@/lib/assets";
import { fetchDexScreenerTokenImage } from "@/lib/assetSearchApi";
import type { PriceSourceName } from "@/lib/chainReads";

type IconAsset = { symbol: string; source: PriceSourceName; sourceId: string };

/** A real logo when one's known (BTC/ETH/SOL, via lib/assets.ts's Trust
 * Wallet lookup) or discoverable live from DexScreener (any
 * dexscreener-sourced asset, keyed by its pair address) — `null` otherwise,
 * letting the caller fall back to something else. There's no image field
 * on-chain to read this from directly (see MarketFactory.sol's AssetInfo),
 * which is why the DexScreener case is a network fetch rather than a plain
 * lookup. */
export function useAssetIconUrl(asset: IconAsset): string | null {
  const known = knownAssetIconUrl(asset.symbol);

  const { data } = useQuery({
    queryKey: ["dexscreenerTokenImage", asset.sourceId],
    queryFn: () => fetchDexScreenerTokenImage(asset.sourceId),
    enabled: !known && asset.source === "dexscreener",
    staleTime: Infinity, // a token's logo essentially never changes
    retry: false,
  });

  return known ?? data ?? null;
}

/** Renders that logo as an `<img>` filling `className`'s box, or a colored
 * initials badge (the pre-existing look) if there's no known/fetched image
 * yet, or the image fails to actually load. */
export function AssetIcon({
  asset,
  className = "",
  textClassName = "text-gray-950",
}: {
  asset: IconAsset;
  className?: string;
  textClassName?: string;
}) {
  const url = useAssetIconUrl(asset);
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={asset.symbol}
        className={`object-contain ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`flex items-center justify-center font-extrabold ${textClassName} ${className}`}
      style={{ backgroundColor: assetColor(asset.symbol) }}
    >
      {asset.symbol.slice(0, 4)}
    </span>
  );
}
