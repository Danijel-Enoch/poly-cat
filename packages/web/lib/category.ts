/** Neither categories nor images are part of the on-chain schema — they're
 * encoded as `[Category]` and `[img:CID]` prefixes on the existing
 * `metadataURI` field (which already doubles as the free-text title when a
 * market has no separate resolution-criteria URI). Markets created before
 * either tag existed simply parse to `category: null` / `image: null`. */

export const CATEGORIES = ["Politics", "Crypto", "Sports", "Culture", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

const CATEGORY_TAG_RE = /^\[(\w+)\]/;
const IMAGE_TAG_RE = /^\[img:([^\]]+)\]/;

export function encodeMetadataURI(category: Category, body: string, imageCid?: string): string {
  const imageTag = imageCid ? `[img:${imageCid}]` : "";
  return `[${category}]${imageTag}${body}`;
}

export function parseMetadataURI(metadataURI: string): {
  category: Category | null;
  image: string | null;
  title: string;
} {
  let rest = metadataURI;

  let category: Category | null = null;
  const categoryMatch = rest.match(CATEGORY_TAG_RE);
  if (categoryMatch && (CATEGORIES as readonly string[]).includes(categoryMatch[1])) {
    category = categoryMatch[1] as Category;
    rest = rest.slice(categoryMatch[0].length);
  }

  let image: string | null = null;
  const imageMatch = rest.match(IMAGE_TAG_RE);
  if (imageMatch) {
    image = imageMatch[1];
    rest = rest.slice(imageMatch[0].length);
  }

  return { category, image, title: rest };
}
