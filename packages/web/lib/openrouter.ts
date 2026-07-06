import { CATEGORIES, type Category } from "./category";
import { normalizeTitle } from "./marketDedupe";
import { searchPolymarketMarkets, type PolymarketMarket, type PolymarketResolution } from "./polymarket";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
// Appending ":online" turns any OpenRouter model into a web-search-augmented
// one for this call — OpenRouter runs the search itself and feeds results
// back to the model as grounding, rather than us standing up our own scraper.
const ONLINE_SUFFIX = ":online";

export type SelectedMarket = {
  question: string;
  category: Category;
  polymarketId: string;
  sourceUrl: string;
  /** ISO date string echoing the Polymarket end date, if any — buildImportPlan
   * (lib/marketImport.ts) is responsible for clamping this to the contract's
   * MIN_TRADING_DURATION floor before it's used as an actual closeTime. */
  endDate: string | null;
  imageUrl: string | null;
};

type SelectMajorMarketsArgs = {
  candidates: PolymarketMarket[];
  existingTitles: string[];
  count: number;
};

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

// No schema-validation library in this repo (matches the rest of the codebase's
// minimal-dependency style) — hand-validate the shape we asked the model for
// and drop anything that doesn't match rather than throwing on one bad item.
function parseSelection(raw: unknown, candidatesById: Map<string, PolymarketMarket>): SelectedMarket[] {
  const maybeMarkets = (raw as { markets?: unknown } | null)?.markets;
  const items = Array.isArray(raw) ? raw : Array.isArray(maybeMarkets) ? maybeMarkets : null;
  if (!items) return [];

  const results: SelectedMarket[] = [];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const { polymarketId, question, category } = item as Record<string, unknown>;
    if (typeof polymarketId !== "string" || typeof question !== "string" || !isCategory(category)) continue;
    const source = candidatesById.get(polymarketId);
    if (!source) continue; // model must pick from the provided candidate list, not invent one
    results.push({
      question: question.trim(),
      category,
      polymarketId,
      sourceUrl: source.url,
      endDate: source.endDate,
      imageUrl: source.imageUrl,
    });
  }
  return results;
}

/** Asks an OpenRouter-hosted LLM to pick the most "major" (high-profile,
 * high-interest) markets out of a Polymarket candidate list, rewrite each as
 * a natural yes/no question, map it into HoodMarkets' fixed category set, and
 * skip anything that duplicates an already-existing HoodMarkets market — even
 * if the wording differs (a fuzzier second pass on top of the cheap
 * normalized-string pre-filter in lib/marketDedupe.ts). */
export async function selectMajorMarkets({
  candidates,
  existingTitles,
  count,
}: SelectMajorMarketsArgs): Promise<SelectedMarket[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Market import is not configured (missing OPENROUTER_API_KEY).");
  }
  if (count <= 0 || candidates.length === 0) return [];

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const candidatesById = new Map(candidates.map((c) => [c.id, c]));

  const prompt = `You are selecting prediction markets to launch on a new platform called HoodMarkets.

Below is a JSON array of candidate markets currently trending on Polymarket. Pick up to ${count} of the most MAJOR ones — high-profile, broadly newsworthy topics (major elections, macro/crypto price milestones, major sports championships, major cultural events) that a general audience would recognize. Prefer variety across categories over picking many near-identical markets.

For each one you pick:
- "polymarketId": copy the "id" field exactly from the candidate you're selecting.
- "question": rewrite the market's question as a single, clear, self-contained yes/no question (HoodMarkets only supports binary yes/no markets).
- "category": exactly one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")} — pick the closest fit, use "Other" only if nothing else fits.

Do NOT select a market whose question means essentially the same thing as any of these already-existing HoodMarkets questions (existing questions to avoid duplicating):
${existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "(none yet)"}

Candidates:
${JSON.stringify(candidates.map((c) => ({ id: c.id, question: c.question, description: c.description, category: c.category, endDate: c.endDate, volume: c.volume })))}

Respond with ONLY a JSON object of the exact shape {"markets": [{"polymarketId": "...", "question": "...", "category": "..."}]} and nothing else.`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response did not contain message content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter response was not valid JSON.");
  }

  return parseSelection(parsed, candidatesById).slice(0, count);
}

export type MarketResearchSource = { title: string; url: string };

export type MarketOutcome = "YES" | "NO" | "UNCLEAR";

export type MarketResearchResult = {
  outcome: MarketOutcome;
  confidence: number;
  reasoning: string;
  sources: MarketResearchSource[];
  matchedPolymarketUrl: string | null;
};

type ResearchMarketOutcomeArgs = {
  question: string;
  closeTimeSeconds: number;
};

const MIN_MATCH_SCORE = 0.3;

/** Picks the Polymarket search result that best overlaps the HoodMarkets
 * question, scored by Jaccard similarity (shared normalized word tokens over
 * the union of both) — cheap and dependency-free, matching the style of the
 * pre-filter in lib/marketDedupe.ts. Jaccard rather than a plain containment
 * ratio, because Polymarket's per-country/per-award market families reuse
 * almost the same sentence (e.g. "Will Portugal win the World Cup?" vs "...win
 * the Fair Play Award for the World Cup?") — a score that only measured how
 * much of the target's words the candidate contains would let those verbose
 * near-duplicates tie or beat the actual exact match. Returns null rather
 * than a weak guess when nothing clears the similarity floor, since a wrong
 * "match" would actively mislead the settlement prompt. */
export function pickBestPolymarketMatch(
  question: string,
  candidates: PolymarketResolution[],
): PolymarketResolution | null {
  const targetTokens = new Set(normalizeTitle(question).split(" ").filter(Boolean));
  if (targetTokens.size === 0 || candidates.length === 0) return null;

  let best: PolymarketResolution | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const candidateTokens = new Set(normalizeTitle(candidate.question).split(" ").filter(Boolean));
    let intersection = 0;
    targetTokens.forEach((t) => {
      if (candidateTokens.has(t)) intersection++;
    });
    const unionSize = targetTokens.size + candidateTokens.size - intersection;
    const score = unionSize === 0 ? 0 : intersection / unionSize;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= MIN_MATCH_SCORE ? best : null;
}

function describePolymarketMatch(match: PolymarketResolution | null): string {
  if (!match) return "No matching Polymarket market was found — rely on web search instead.";
  if (match.resolved) {
    return `A matching Polymarket market has already resolved:\n- Question: "${match.question}"\n- Winning outcome: "${match.winningOutcome}"\n- URL: ${match.url}`;
  }
  if (match.closed) {
    return `A matching Polymarket market is closed but not yet resolved (e.g. under dispute):\n- Question: "${match.question}"\n- URL: ${match.url}`;
  }
  const odds = match.outcomes.map((o, i) => `${o} ${Math.round((match.outcomePrices[i] ?? 0) * 100)}%`).join(", ");
  return `A matching Polymarket market is still trading (not a resolution, just a probability signal):\n- Question: "${match.question}"\n- Implied odds: ${odds}\n- URL: ${match.url}`;
}

function isOutcome(value: unknown): value is MarketOutcome {
  return value === "YES" || value === "NO" || value === "UNCLEAR";
}

function parseResearchResult(raw: unknown): { outcome: MarketOutcome; confidence: number; reasoning: string; sources: MarketResearchSource[] } {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("OpenRouter response was not a JSON object.");
  }
  const { outcome, confidence, reasoning, sources } = raw as Record<string, unknown>;
  if (!isOutcome(outcome) || typeof reasoning !== "string") {
    throw new Error("OpenRouter response was missing outcome/reasoning.");
  }
  const parsedSources: MarketResearchSource[] = [];
  if (Array.isArray(sources)) {
    for (const s of sources) {
      if (typeof s === "object" && s !== null) {
        const { title, url } = s as Record<string, unknown>;
        if (typeof url === "string") parsedSources.push({ title: typeof title === "string" ? title : url, url });
      }
    }
  }
  const confidenceNumber = typeof confidence === "number" ? confidence : Number(confidence);
  return {
    outcome,
    confidence: Number.isFinite(confidenceNumber) ? Math.max(0, Math.min(100, Math.round(confidenceNumber))) : 50,
    reasoning: reasoning.trim(),
    sources: parsedSources,
  };
}

// OpenRouter's web-search plugin attaches its citations here regardless of
// whether the model also echoed them into the JSON body — pick these up too
// so a source never silently disappears just because the model forgot to
// list it in "sources".
function parseAnnotationSources(annotations: unknown): MarketResearchSource[] {
  if (!Array.isArray(annotations)) return [];
  const results: MarketResearchSource[] = [];
  for (const a of annotations) {
    if (typeof a !== "object" || a === null) continue;
    const citation = (a as Record<string, unknown>).url_citation;
    if (typeof citation !== "object" || citation === null) continue;
    const { url, title } = citation as Record<string, unknown>;
    if (typeof url === "string") results.push({ title: typeof title === "string" ? title : url, url });
  }
  return results;
}

/** Researches what really happened for a HoodMarkets question so an admin can
 * decide how to settle it — never settles anything itself. Looks up a
 * corresponding Polymarket market for a resolution/odds signal, then asks a
 * web-search-augmented OpenRouter model to confirm (or override) that with
 * fresh sources, since Polymarket may not cover the market at all or may not
 * have resolved it yet. Settlement stays a human, on-chain action
 * (MarketFactory.settleMarket) — see admin/page.tsx. */
export async function researchMarketOutcome({
  question,
  closeTimeSeconds,
}: ResearchMarketOutcomeArgs): Promise<MarketResearchResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Market research is not configured (missing OPENROUTER_API_KEY).");
  }

  const candidates = await searchPolymarketMarkets(question).catch(() => []);
  const match = pickBestPolymarketMatch(question, candidates);

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const closeDate = new Date(closeTimeSeconds * 1000).toISOString();

  const prompt = `You are a settlement research assistant for a prediction-market platform called HoodMarkets. An admin needs to settle the following market, which closed for trading on ${closeDate}:

"${question}"

${describePolymarketMatch(match)}

Use web search to confirm what actually happened in the real world, especially if the Polymarket data above is missing, stale, or not yet resolved. Then decide how this market should settle: "YES" if the question's answer is yes, "NO" if the answer is no, or "UNCLEAR" only if the real-world outcome genuinely cannot be determined yet — do not guess.

Respond with ONLY a JSON object of this exact shape and nothing else:
{"outcome": "YES" | "NO" | "UNCLEAR", "confidence": <integer 0-100>, "reasoning": "<2-4 sentences citing what you found>", "sources": [{"title": "...", "url": "..."}]}`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: `${model}${ONLINE_SUFFIX}`,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response did not contain message content.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenRouter response was not valid JSON.");
  }

  const result = parseResearchResult(parsed);

  const seenUrls = new Set(result.sources.map((s) => s.url));
  for (const source of parseAnnotationSources(message?.annotations)) {
    if (!seenUrls.has(source.url)) {
      result.sources.push(source);
      seenUrls.add(source.url);
    }
  }

  return { ...result, matchedPolymarketUrl: match?.url ?? null };
}
