// Cheap pre-filter run before candidates are sent to the LLM (lib/openrouter.ts),
// so obviously-duplicate questions never cost an AI call in the first place.
// This is deliberately conservative (normalized-substring match) — the LLM
// selection step is told to also avoid near-duplicates as a second, fuzzier pass.

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelyDuplicate(title: string, existingTitles: string[]): boolean {
  const normalized = normalizeTitle(title);
  if (!normalized) return false;
  return existingTitles.some((existing) => {
    const normalizedExisting = normalizeTitle(existing);
    if (!normalizedExisting) return false;
    return (
      normalized === normalizedExisting ||
      normalized.includes(normalizedExisting) ||
      normalizedExisting.includes(normalized)
    );
  });
}

export function filterLikelyDuplicates<T extends { question: string }>(
  candidates: T[],
  existingTitles: string[],
): T[] {
  return candidates.filter((c) => !isLikelyDuplicate(c.question, existingTitles));
}
