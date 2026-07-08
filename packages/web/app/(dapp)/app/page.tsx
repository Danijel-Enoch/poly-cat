import { fetchIndexerMarketsList, type IndexerAssetSlot } from "@/lib/indexerApi";
import { getDelistedAssetIds, getAssetOrder } from "@/lib/assetDisplayStore";
import { MarketCard } from "@/components/MarketCard";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-100 uppercase tracking-tight">Live windows</h1>
        <p className="text-sm text-gray-400 mt-1">
          Every market is a 5-minute Up/Down sprint. Ape before it closes — Down wins if the price dips below the
          strike, Up wins if it rips. gm degens.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleSlots.map((slot, index) => (
          <MarketCard key={slot.asset.id.toString()} slot={slot} index={index} />
        ))}
      </div>
    </div>
  );
}
