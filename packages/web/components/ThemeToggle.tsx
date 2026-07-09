"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

const subscribeNoop = () => () => {};

/** True only once mounted on the client — resolves via useSyncExternalStore
 * (server snapshot false, client snapshot true) rather than a setState-in-
 * effect mount flag, so there's no extra render pass to avoid. */
function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function IconSun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function IconMoon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  );
}

/** Icon-only light/dark switch — no text label. Toggles between "light" and
 * "dark" directly (ignoring next-themes' "system" option) since a single
 * icon button can only meaningfully show/target two states; system
 * preference still applies as the default until someone clicks this. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is undefined until after mount (next-themes reads
  // localStorage/system preference client-side to avoid an SSR mismatch) —
  // render a neutral, non-interactive placeholder of the same size until then
  // rather than guessing and risking a flash of the wrong icon.
  const mounted = useMounted();

  if (!mounted) {
    return <span className={`inline-block h-9 w-9 ${className}`} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:text-foreground hover:bg-accent transition-colors ${className}`}
    >
      {isDark ? <IconSun className="w-[18px] h-[18px]" /> : <IconMoon className="w-[18px] h-[18px]" />}
    </button>
  );
}
