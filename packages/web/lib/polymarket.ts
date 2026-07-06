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

// `outcomes`/`outcomePrices` come back from Gamma as JSON-encoded strings
// (e.g. `"[\"Yes\", \"No\"]"`), not real arrays — parse defensively since this
// is a third-party API response, not a type we control.
function parseJsonArray(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export type PolymarketResolution = {
  id: string;
  question: string;
  description: string;
  url: string;
  closed: boolean;
  /** True once Polymarket has a definitive winner — one outcome priced at (or
   * essentially at) 1 and the rest at 0. A 50/50 "closed" market (voided, or
   * still mid-UMA-dispute) is deliberately NOT treated as resolved. */
  resolved: boolean;
  outcomes: string[];
  outcomePrices: number[];
  winningOutcome: string | null;
};

type GammaSearchMarket = GammaMarket & {
  slug?: string;
  closed?: boolean;
  outcomes?: string;
  outcomePrices?: string;
};

type GammaSearchResponse = {
  events?: { markets?: GammaSearchMarket[] }[];
};

const RESOLVED_PRICE_THRESHOLD = 0.98;

function toResolution(m: GammaSearchMarket): PolymarketResolution | null {
  if (typeof m.question !== "string" || m.question.trim().length === 0) return null;

  const outcomes = parseJsonArray(m.outcomes);
  const outcomePrices = parseJsonArray(m.outcomePrices).map((p) => Number(p));
  const closed = m.closed === true;

  const winnerIndex = outcomePrices.findIndex((p) => p >= RESOLVED_PRICE_THRESHOLD);
  const resolved = closed && winnerIndex !== -1;

  return {
    id: String(m.id ?? m.slug ?? m.question),
    question: m.question.trim(),
    description: m.description?.trim() ?? "",
    url: m.slug ? `https://polymarket.com/event/${m.slug}` : "https://polymarket.com",
    closed,
    resolved,
    outcomes,
    outcomePrices,
    winningOutcome: resolved ? (outcomes[winnerIndex] ?? null) : null,
  };
}

/** Full-text search over Polymarket's markets (open or resolved), used to find
 * the market that corresponds to a HoodMarkets question at settlement time —
 * unlike fetchTrendingPolymarketMarkets, this isn't limited to what's
 * currently trending. */
export async function searchPolymarketMarkets(query: string, limitPerType = 5): Promise<PolymarketResolution[]> {
  const url = new URL(`${POLYMARKET_API_URL}/public-search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit_per_type", String(limitPerType));

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Polymarket search failed: ${res.status} ${await res.text()}`);
  }

  const raw = (await res.json()) as GammaSearchResponse;
  const markets = (raw.events ?? []).flatMap((e) => e.markets ?? []);
  const results: PolymarketResolution[] = [];
  for (const m of markets) {
    const parsed = toResolution(m);
    if (parsed) results.push(parsed);
  }
  return results;
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
