import { fetchIndexerMarketsList, type IndexerAssetSlot } from "@/lib/indexerApi";
import { getDelistedAssetIds, getAssetOrder } from "@/lib/assetDisplayStore";
import { MarketsGrid } from "@/components/MarketsGrid";
import { PageHeader } from "@/components/ui/page-header";

// Not statically prerendered at build time — this always needs a fresh read
// (via packages/indexer, see lib/indexerApi.ts) rather than whatever was
// true when `next build` ran.
export const dynamic = "force-dynamic";

export default async function Home() {
  const slots = await fetchIndexerMarketsList();

  // Admin-curated display state (see lib/assetDisplayStore.ts) — delisting
  // and reordering only affect what shows here, never on-chain state; a
  // delisted market keeps trading/settling normally for anyone with a
  // direct link.
  const allIds = slots.map((slot) => slot.asset.id.toString());
  const [delistedAssetIds, order] = await Promise.all([getDelistedAssetIds(), getAssetOrder(allIds)]);
  const delisted = new Set(delistedAssetIds);
  const slotsById = new Map(slots.map((slot) => [slot.asset.id.toString(), slot]));
  const visibleSlots = order
    .filter((id) => !delisted.has(id))
    .map((id) => slotsById.get(id))
    .filter((slot): slot is IndexerAssetSlot => !!slot);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Live windows"
        title="Markets"
        description="Every market runs a fixed five-minute Up/Down window. Down wins if the price falls below the strike, Up wins if it rises above it."
      />

      <MarketsGrid slots={visibleSlots} />
    </div>
  );
}
