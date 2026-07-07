import { NextRequest } from "next/server";

// Server-side proxy to Gate.com's public currency-pairs list — sidesteps
// CORS and keeps the "USDT pairs only, tradable only" filter in one place.
// Backs the admin dashboard's "Add market" panel: an admin searches by
// symbol, picks a result, and that becomes a `registerAsset(symbol, Gate,
// currencyPair)` call.
type GatePair = { id: string; base: string; base_name: string; quote: string; trade_status: string };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toUpperCase();

  const res = await fetch("https://api.gateio.ws/api/v4/spot/currency_pairs", { next: { revalidate: 3600 } });
  if (!res.ok) {
    return Response.json({ error: "Gate.com pairs request failed" }, { status: 502 });
  }

  const data = (await res.json()) as GatePair[];
  const usdtPairs = data.filter((p) => p.quote === "USDT" && p.trade_status === "tradable");
  const filtered = q ? usdtPairs.filter((p) => p.base.toUpperCase().includes(q)) : usdtPairs.slice(0, 50);

  const results = filtered.slice(0, 30).map((p) => ({
    currencyPair: p.id,
    symbol: p.base,
    name: p.base_name,
  }));

  return Response.json({ results });
}
