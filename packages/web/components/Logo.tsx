import Image from "next/image";
import pawMark from "@/public/polycat-paw.png";

/** Polycat's paw-print mark, a transparent-background PNG designed at 592×532
 * (roughly 1.11:1) — height is derived from `size` to preserve that aspect
 * ratio rather than forcing a square box like the old monogram did. */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <Image
      src={pawMark}
      alt="Polycat"
      width={size}
      height={Math.round((size * 532) / 592)}
      className={className}
      priority
    />
  );
}
