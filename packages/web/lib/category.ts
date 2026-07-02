/** Categories aren't part of the on-chain schema — they're encoded as a
 * `[Category]` prefix on the existing `metadataURI` field (which already doubles
 * as the free-text title when a market has no separate resolution-criteria URI).
 * Markets created before this existed simply parse to `category: null`. */

export const CATEGORIES = ["Politics", "Crypto", "Sports", "Culture", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

const CATEGORY_TAG_RE = /^\[(\w+)\]/;

export function encodeMetadataURI(category: Category, body: string): string {
  return `[${category}]${body}`;
}

export function parseMetadataURI(metadataURI: string): { category: Category | null; title: string } {
  const match = metadataURI.match(CATEGORY_TAG_RE);
  if (match && (CATEGORIES as readonly string[]).includes(match[1])) {
    return { category: match[1] as Category, title: metadataURI.slice(match[0].length) };
  }
  return { category: null, title: metadataURI };
}
