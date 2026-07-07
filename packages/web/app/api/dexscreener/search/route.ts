import { NextRequest } from "next/server";

// Server-side proxy to DexScreener's public search API — sidesteps CORS and
// keeps the "only Robinhood Chain pairs" filter in one place. Backs the
// admin dashboard's "Add market" panel: an admin searches by name/symbol,
// picks a result, and that becomes a `registerAsset(symbol, DexScreener,
// pairAddress)` call.
const ROBINHOOD_CHAIN_ID = "robinhood";

type DexPair = {
  chainId: string;
  pairAddress: string;
  baseToken: { symbol: string; name: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return Response.json({ results: [] });
  }

  const url = new URL("https://api.dexscreener.com/latest/dex/search");
  url.searchParams.set("q", q);

  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) {
    return Response.json({ error: "DexScreener search failed" }, { status: 502 });
  }

  const data = (await res.json()) as { pairs?: DexPair[] | null };
  const results = (data.pairs ?? [])
    .filter((p) => p.chainId === ROBINHOOD_CHAIN_ID)
    .slice(0, 20)
    .map((p) => ({
      pairAddress: p.pairAddress,
      symbol: p.baseToken.symbol,
      name: p.baseToken.name,
      priceUsd: p.priceUsd ?? null,
      liquidityUsd: p.liquidity?.usd ?? null,
    }));

  return Response.json({ results });
}
