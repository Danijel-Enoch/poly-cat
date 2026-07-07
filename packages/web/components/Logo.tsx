/** Simple monogram mark, replacing the old lime-green leaf PNG (`public/
 * logo-mark.png`) — that raster asset is a leftover from the previous brand
 * and can't be recolored in place. Kept as plain inline SVG (not an <Image>)
 * so it always renders in the current accent color with zero network
 * request, and stays crisp at any size. */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      role="img"
      aria-label="Robin Markets"
    >
      <rect width="36" height="36" rx="10" className="fill-accent" />
      <text
        x="18"
        y="25"
        textAnchor="middle"
        fontSize="20"
        fontWeight="800"
        fontFamily="var(--font-geist-sans), sans-serif"
        fill="white"
      >
        R
      </text>
    </svg>
  );
}
