import { NextRequest } from "next/server";
import { getAsset } from "@/lib/chainReads";

// Server-side proxy to Gate.com's public REST API — the same source
// packages/cron uses to settle Gate-sourced ("blue chip") assets, so the
// chart a trader sees lines up with what actually settles the market.
// Proxied (rather than called directly from the browser) to sidestep CORS
// and keep the price source in one place if it ever needs to change.
//
// DexScreener-sourced assets (memecoins) don't use this route at all —
// DexScreener's public API has no historical-candles endpoint, only current
// pair state, which is exactly why those markets render DexScreener's own
// embeddable chart widget client-side instead (see PriceHistoryChart.tsx).
type GateCandle = [string, string, string, string, string, string, string, string];

export async function GET(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;

  let asset;
  try {
    asset = await getAsset(BigInt(assetId));
  } catch {
    return Response.json({ error: `Unknown asset "${assetId}"` }, { status: 400 });
  }
  if (asset.source !== "gate") {
    return Response.json(
      { error: "This asset is DexScreener-sourced — use its embedded chart instead of this route." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const klinesUrl = new URL("https://api.gateio.ws/api/v4/spot/candlesticks");
  klinesUrl.searchParams.set("currency_pair", asset.sourceId);
  klinesUrl.searchParams.set("interval", "10s"); // finest granularity Gate offers — fits a 5-minute window with ~30 points
  if (from) klinesUrl.searchParams.set("from", from);
  if (to) klinesUrl.searchParams.set("to", to);

  const tickerUrl = new URL("https://api.gateio.ws/api/v4/spot/tickers");
  tickerUrl.searchParams.set("currency_pair", asset.sourceId);

  const [klinesRes, tickerRes] = await Promise.all([
    fetch(klinesUrl, { next: { revalidate: 5 } }),
    fetch(tickerUrl, { cache: "no-store" }),
  ]);

  if (!klinesRes.ok) {
    return Response.json({ error: "Price feed unavailable" }, { status: 502 });
  }

  const candles = (await klinesRes.json()) as GateCandle[];
  // Gate's candlestick array order is [timestamp, quote_volume, close, high,
  // low, open, base_volume, window_closed] — close (not open) is index 2,
  // a well-known quirk of this API that's easy to get backwards.
  const points = candles
    .map((c) => ({ t: Number(c[0]), price: Number(c[2]) }))
    .sort((a, b) => a.t - b.t);

  let current: number | null = null;
  if (tickerRes.ok) {
    const ticker = (await tickerRes.json()) as { last: string }[];
    current = ticker[0] ? Number(ticker[0].last) : null;
  } else if (points.length > 0) {
    current = points[points.length - 1].price;
  }

  return Response.json({ points, current });
}
