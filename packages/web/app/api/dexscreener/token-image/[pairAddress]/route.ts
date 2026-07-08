import { NextRequest } from "next/server";

// Server-side proxy to DexScreener's single-pair endpoint, trimmed down to
// just the token's image URL — sidesteps CORS the same way
// /api/dexscreener/search does. There's no image field on-chain for a
// registered asset (see MarketFactory.sol's AssetInfo), so every
// DexScreener-sourced (memecoin) market's card/badge fetches this live
// rather than storing it at registerAsset time — see components/AssetIcon.tsx.
const ROBINHOOD_CHAIN_ID = "robinhood";

type DexPairResponse = {
  pairs?: Array<{ info?: { imageUrl?: string } }> | null;
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ pairAddress: string }> }) {
  const { pairAddress } = await params;

  const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/${ROBINHOOD_CHAIN_ID}/${pairAddress}`, {
    next: { revalidate: 3600 }, // token images essentially never change; an hour is plenty fresh
  });
  if (!res.ok) {
    return Response.json({ imageUrl: null }, { status: 502 });
  }

  const data = (await res.json()) as DexPairResponse;
  const imageUrl = data.pairs?.[0]?.info?.imageUrl ?? null;
  return Response.json({ imageUrl });
}
