import type { ReactNode } from "react";

/** The gradient "holo" card border used across the site (market cards,
 * feature highlights, stat tiles, position rows) — a gold→pink gradient
 * behind a ~1.5px inset, instead of a flat single-color border, so cards
 * read as a distinct visual identity rather than generic dashboard tiles.
 * `active={false}` (an unopened market, a disabled tile) falls back to a
 * flat gray border instead of the gradient. `radius` is a plain px number
 * (not a Tailwind class) since it needs to vary per call site and Tailwind
 * can't build arbitrary-value classes from a JS variable. */
export function HoloCard({
  children,
  active = true,
  glow = true,
  radius = 24,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  active?: boolean;
  glow?: boolean;
  radius?: number;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={`relative transition-shadow ${
        active
          ? `bg-gradient-to-br from-accent via-[#ff9ec3] to-[#ff2e88] ${glow ? "hover:shadow-[0_0_24px_rgba(255,208,0,0.2)]" : ""}`
          : "bg-gray-800"
      } ${className}`}
      style={{ borderRadius: radius, padding: 1.5 }}
    >
      <div className={`h-full bg-gray-950 ${innerClassName}`} style={{ borderRadius: radius - 1.5 }}>
        {children}
      </div>
    </div>
  );
}
