"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import pawMark from "@/public/polycat-paw.png";
import wordmarkLight from "@/public/polycat-wordmark.png";
import wordmarkDark from "@/public/polycat-wordmark-dark.png";

const subscribeNoop = () => () => {};

/** True only once mounted on the client — same pattern as
 * components/ThemeToggle.tsx, used here to pick the right wordmark variant
 * without a flash of the wrong one (resolvedTheme is undefined pre-mount). */
function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/** Polycat's paw-print mark, a transparent-background PNG designed at 592×532
 * (roughly 1.11:1) — height is derived from `size` to preserve that aspect
 * ratio rather than forcing a square box like the old monogram did.
 *
 * `variant="full"` renders the complete paw+wordmark lockup (697×160,
 * ~4.36:1) instead — sized by `height`, width derived. The wordmark's text
 * is baked into the PNG (not CSS-driven), so it can't just inherit
 * `text-foreground` the way live text would — two pre-rendered variants
 * (light-mode dark ink / dark-mode #f0ede4, matching the ink-equivalent
 * already used for RainbowKit's dark theme in app/providers.tsx) are
 * swapped based on the resolved theme instead. */
export function Logo({
  variant = "mark",
  size = 36,
  height,
  className,
}: {
  variant?: "mark" | "full";
  size?: number;
  height?: number;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  if (variant === "full") {
    const h = height ?? size;
    // Defaults to the light-mode wordmark pre-mount, matching the rest of
    // the app's light-first fallback before theme resolves.
    const src = mounted && resolvedTheme === "dark" ? wordmarkDark : wordmarkLight;
    return (
      <Image
        src={src}
        alt="Polycat"
        width={Math.round((h * 697) / 160)}
        height={h}
        className={className}
        priority
      />
    );
  }

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
