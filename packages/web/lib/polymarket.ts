// Read-only client for Polymarket's public Gamma API — no API key needed to
// list markets. Used by both the admin-UI import route and the standalone
// scripts/import-polymarket-markets.ts script (see lib/marketImport.ts).

const POLYMARKET_API_URL = process.env.POLYMARKET_API_URL ?? "https://gamma-api.polymarket.com";

export type PolymarketMarket = {
  id: string;
  question: string;
  description: string;
  category: string | null;
  endDate: string | null; // ISO date string
  volume: number;
  url: string;
  imageUrl: string | null;
};

// Gamma's raw market shape has dozens of fields we don't use — only pick out
// what selectMajorMarkets/buildImportPlan actually needs, and tolerate the
// rest being missing/differently-typed (public third-party API, not under
// our control).
type GammaMarket = {
  id?: string | number;
  question?: string;
  description?: string;
  category?: string;
  endDate?: string;
  volume?: string | number;
  volume24hr?: string | number;
  slug?: string;
  image?: string;
  icon?: string;
};

function toNumber(value: string | number | undefined): number {
  if (value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchTrendingPolymarketMarkets(limit: number): Promise<PolymarketMarket[]> {
  const url = new URL(`${POLYMARKET_API_URL}/markets`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("order", "volume24hr");
  url.searchParams.set("ascending", "false");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Polymarket API request failed: ${res.status} ${await res.text()}`);
  }

  const raw = (await res.json()) as GammaMarket[];
  return raw
    .filter((m) => typeof m.question === "string" && m.question.trim().length > 0)
    .map((m) => ({
      id: String(m.id ?? m.slug ?? m.question),
      question: m.question!.trim(),
      description: m.description?.trim() ?? "",
      category: m.category ?? null,
      endDate: m.endDate ?? null,
      volume: toNumber(m.volume24hr ?? m.volume),
      url: m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com",
      imageUrl: m.image ?? m.icon ?? null,
    }));
}
