const PALETTE = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-lime-600",
];

/** Deterministic decorative avatar color per market id, since markets have no image. */
export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
