import { getMarketsList } from "@/lib/chainReads";
import { MarketCard } from "@/components/MarketCard";

// Reads live chain state on every request — must never be statically
// prerendered at build time. Without this, `next build` tries to prerender
// this page once during the build and fails outright if the RPC isn't
// reachable from the build environment (e.g. a local-only Anvil URL,
// unreachable from Vercel), taking the whole deployment down with it rather
// than just this route.
export const dynamic = "force-dynamic";

export default async function Home() {
  const slots = await getMarketsList();

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
        {slots.map((slot, index) => (
          <MarketCard key={slot.asset.id.toString()} slot={slot} index={index} />
        ))}
      </div>
    </div>
  );
}
