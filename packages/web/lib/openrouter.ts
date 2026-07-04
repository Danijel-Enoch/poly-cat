import { CATEGORIES, type Category } from "./category";
import type { PolymarketMarket } from "./polymarket";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";

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
